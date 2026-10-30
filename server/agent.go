package main

import (
	crand "crypto/rand"
	"encoding/json"
	"math/big"
	"net"
	"net/http"
	"strings"
	"time"
)

// ایجنت‌ها با توکن خودشان احراز می‌شوند (نیازی به توکن کاربر ندارند)

func (s *Server) agent(h func(http.ResponseWriter, *http.Request, Node)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if tok == "" {
			tok = r.URL.Query().Get("token")
		}
		s.st.mu.Lock()
		var n Node
		found := false
		for _, x := range s.st.d.Nodes {
			if x.Token == tok {
				n, found = x, true
				break
			}
		}
		s.st.mu.Unlock()
		if !found {
			errJSON(w, 401, "توکن ایجنت نامعتبر است")
			return
		}
		h(w, r, n)
	}
}

func (s *Server) touch(n Node, ip string, version, osInfo string, relayPort int) {
	s.st.mu.Lock()
	for i := range s.st.d.Nodes {
		if s.st.d.Nodes[i].ID == n.ID {
			if ip != "" {
				s.st.d.Nodes[i].ObservedIP = ip
			}
			if version != "" {
				s.st.d.Nodes[i].AgentVersion = version
			}
			if osInfo != "" {
				s.st.d.Nodes[i].OSInfo = osInfo
			}
			if relayPort > 0 {
				s.st.d.Nodes[i].RelayPort = relayPort
			}
			s.st.d.Nodes[i].LastSeen = nowStr()
			s.st.d.Nodes[i].Online = true
		}
	}
	s.st.ensurePrivatePorts()
	_ = s.st.save()
	s.st.mu.Unlock()
}

func (s *Server) agentRegister(w http.ResponseWriter, r *http.Request, n Node) {
	var in struct {
		Hostname  string `json:"hostname"`
		IP        string `json:"ip"`
		Version   string `json:"version"`
		OSInfo    string `json:"os_info"`
		RelayPort int    `json:"relay_port"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	s.touch(n, observedIP(r), in.Version, in.OSInfo, in.RelayPort)
	writeJSON(w, 200, map[string]any{"ok": true, "node": n.ID})
}

func (s *Server) agentHeartbeat(w http.ResponseWriter, r *http.Request, n Node) {
	var in struct {
		IP           string `json:"ip"`
		Version      string `json:"version"`
		OSInfo       string `json:"os_info"`
		RelayPort    int    `json:"relay_port"`
		CPUPercent   float64 `json:"cpu_percent"`
		MemUsedBytes int64  `json:"mem_used_bytes"`
		MemTotalByte int64  `json:"mem_total_bytes"`
		Links        []Link `json:"links"`
		ProbeResults []struct {
			ProbeID int           `json:"probe_id"`
			Final   bool          `json:"final"`
			Results []ProbeResult `json:"results"`
		} `json:"probe_results"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	s.touch(n, observedIP(r), in.Version, in.OSInfo, in.RelayPort)
	s.st.mu.Lock()
	for i := range s.st.d.Nodes {
		if s.st.d.Nodes[i].ID == n.ID {
			s.st.d.Nodes[i].CPUPercent = in.CPUPercent
			s.st.d.Nodes[i].MemUsedBytes = in.MemUsedBytes
			s.st.d.Nodes[i].MemTotalByte = in.MemTotalByte
			if in.Links != nil {
				for j := range in.Links {
					in.Links[j].At = nowStr()
				}
				s.st.d.Nodes[i].Links = in.Links
			}
		}
	}
	_ = s.st.save()
	s.st.mu.Unlock()
	for _, pr := range in.ProbeResults {
		s.mu.Lock()
		if p, ok := s.probes[pr.ProbeID]; ok && p.DstID == n.ID {
			p.Results = pr.Results
			p.Final = p.Final || pr.Final
		}
		s.mu.Unlock()
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) agentConfig(w http.ResponseWriter, r *http.Request, n Node) {
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	s.st.ensurePrivatePorts()
	listen := []map[string]any{}
	rev := []map[string]any{}
	direct := []map[string]any{}
	for _, t := range s.st.d.Tunnels {
		if !t.Active {
			continue
		}
		pms, _ := parsePorts(t.Ports)
		if t.SourceNodeID == n.ID {
			for _, pm := range pms {
				item := map[string]any{"id": t.ID, "type": t.Type, "protocol": t.Protocol,
					"listen_port": pm[0], "target_port": pm[1], "target_host": t.TargetHost,
					"token": t.Token, "transport": t.Transport, "profile": t.Profile}
				if t.Type == "forward" && t.DestNodeID > 0 {
					if dn, ok := s.st.Node(t.DestNodeID); ok {
						item["dest_relay_host"] = publicHost(dn)
						item["dest_relay_port"] = dn.RelayPort
						item["dest_private_port"] = dn.PrivatePort
					}
				}
				listen = append(listen, item)
			}
		}
		if t.DestNodeID == n.ID {
			src, _ := s.st.Node(t.SourceNodeID)
			host := publicHost(src)
			if t.Type == "reverse" {
				for _, pm := range pms {
					rev = append(rev, map[string]any{"id": t.ID, "token": t.Token,
						"relay_host": host, "relay_port": src.RelayPort, "private_port": src.PrivatePort,
						"transport": t.Transport, "profile": t.Profile,
						"target_host": t.TargetHost, "target_port": pm[1]})
				}
			} else {
				for _, pm := range pms {
					direct = append(direct, map[string]any{"id": t.ID, "token": t.Token,
						"transport": t.Transport, "profile": t.Profile,
						"target_host": t.TargetHost, "target_port": pm[1]})
				}
			}
		}
	}
	resp := map[string]any{
		"listen": listen, "reverse_connect": rev, "accept_direct": direct,
		"private_key_hex": s.st.d.PrivateKeyHex, "private_sni": s.st.d.PrivateSNI,
	}
	for i := range s.st.d.Nodes {
		if s.st.d.Nodes[i].ID == n.ID {
			resp["relay_port"] = s.st.d.Nodes[i].RelayPort
			resp["private_port"] = s.st.d.Nodes[i].PrivatePort
		}
	}
	// تست اتصال
	s.mu.Lock()
	for _, p := range s.probes {
		if time.Since(p.Created) > 5*time.Minute {
			continue
		}
		if p.SrcID == n.ID {
			resp["probe_listen"] = map[string]any{"probe_id": p.ID, "token": p.Token}
		}
		if p.DstID == n.ID {
			if src, ok := s.st.Node(p.SrcID); ok {
				resp["probe_dial"] = map[string]any{"probe_id": p.ID, "token": p.Token,
					"relay_host": publicHost(src), "relay_port": src.RelayPort,
					"private_port": src.PrivatePort}
			}
		}
	}
	s.mu.Unlock()
	writeJSON(w, 200, resp)
}

func (s *Server) agentBinary(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", 501)
}

// پورت رندمِ ترانسپورت اختصاصی برای هر سرور
func (s *Store) ensurePrivatePorts() {
	changed := false
	for i := range s.d.Nodes {
		if s.d.Nodes[i].PrivatePort == 0 {
			for tries := 0; tries < 40; tries++ {
				n, err := crand.Int(crand.Reader, big.NewInt(40000))
				if err != nil {
					break
				}
				cand := 20000 + int(n.Int64())
				if !portBusy(cand) {
					s.d.Nodes[i].PrivatePort = cand
					break
				}
			}
			changed = true
		}
	}
	if changed {
		_ = s.save()
	}
}

func portBusy(port int) bool {
	ln, err := net.Listen("tcp", net.JoinHostPort("0.0.0.0", itoa(port)))
	if err != nil {
		return true
	}
	_ = ln.Close()
	return false
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	b := []byte{}
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}
