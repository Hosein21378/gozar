package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ---------- آمار ----------

func (s *Server) stats(w http.ResponseWriter, r *http.Request, u User) {
	s.st.mu.Lock()
	online, connected, bytes := 0, 0, int64(0)
	for _, n := range s.st.d.Nodes {
		if n.Online {
			online++
		}
	}
	type row struct {
		ID         int    `json:"id"`
		Name       string `json:"name"`
		Entry      string `json:"entry"`
		Exit       string `json:"exit"`
		Transport  string `json:"transport"`
		Connected  bool   `json:"connected"`
		Bytes      int64  `json:"bytes"`
		PortCount  int             `json:"port_count"`
		PortList   []map[string]int `json:"port_list"`
	}
	series := append([]int64{}, s.st.d.Samples...)
	for len(series) < 12 {
		series = append(series, 0)
	}
	rows := []row{}
	for _, t := range s.st.d.Tunnels {
		_pms, _ := parsePorts(t.Ports)
		pc := len(_pms)
		pl := []map[string]int{}
		for _, pm := range _pms {
			pl = append(pl, map[string]int{"listen": pm[0], "target": pm[1]})
		}
		en, _ := s.st.Node(t.SourceNodeID)
		ex, _ := s.st.Node(t.DestNodeID)
		conn := tunnelConnected(en, ex, t.ID)
		if conn {
			connected++
		}
		bytes += t.Bytes
		rows = append(rows, row{t.ID, t.Name, en.Name, ex.Name, t.Transport, conn, t.Bytes, pc, pl})
	}
	users := len(s.st.d.Users)
	nodes := len(s.st.d.Nodes)
	tuns := len(s.st.d.Tunnels)
	s.st.mu.Unlock()
	writeJSON(w, 200, map[string]any{
		"nodes_total": nodes, "nodes_online": online,
		"tunnels_total": tuns, "tunnels_connected": connected,
		"users_total": users, "traffic_in": bytes / 2, "traffic_out": bytes / 2,
		"tunnels": rows, "series": series,
	})
}

func tunnelConnected(en, ex Node, tid int) bool {
	for _, l := range ex.Links {
		if l.TunnelID != tid {
			continue
		}
		for _, tr := range l.Transports {
			if tr.Up {
				return true
			}
		}
	}
	for _, l := range en.Links {
		if l.TunnelID != tid {
			continue
		}
		for _, tr := range l.Transports {
			if tr.Up {
				return true
			}
		}
	}
	return false
}

// ---------- سرورها ----------

func (s *Server) nodes(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method == "POST" {
		s.createNode(w, r, u)
		return
	}
	s.st.mu.Lock()
	out := []map[string]any{}
	for _, n := range s.st.d.Nodes {
		n.Online = timeSince(n.LastSeen) < 25*time.Second
		out = append(out, nodeOut(n))
	}
	s.st.mu.Unlock()
	writeJSON(w, 200, out)
}

func (s *Server) createNode(w http.ResponseWriter, r *http.Request, u User) {
	if u.Role != "admin" {
		errJSON(w, 403, "فقط مدیر")
		return
	}
	var in struct {
		Name string `json:"name"`
		Host string `json:"host"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	if in.Name == "" {
		errJSON(w, 400, "نام الزامی است")
		return
	}
	s.st.mu.Lock()
	n := Node{ID: s.st.d.NextNodeID, Name: in.Name, Host: in.Host, Token: randStr(48)}
	s.st.d.NextNodeID++
	s.st.d.Nodes = append(s.st.d.Nodes, n)
	s.st.ensurePrivatePorts()
	out := nodeOut(n)
	out["token"] = n.Token
	_ = s.st.save()
	s.st.mu.Unlock()
	writeJSON(w, 200, out)
}

func nodeOut(n Node) map[string]any {
	return map[string]any{
		"id": n.ID, "name": n.Name, "host": n.Host, "observed_ip": n.ObservedIP,
		"reported_ip": n.ReportedIP, "agent_version": n.AgentVersion, "os_info": n.OSInfo,
		"relay_port": n.RelayPort, "private_port": n.PrivatePort, "last_seen": n.LastSeen,
		"online": n.Online, "cpu_percent": n.CPUPercent, "mem_used_bytes": n.MemUsedBytes,
		"mem_total_bytes": n.MemTotalByte,
	}
}

func timeSince(iso string) time.Duration {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return time.Hour * 24
	}
	return time.Since(t)
}

func (s *Server) nodeOps(w http.ResponseWriter, r *http.Request, u User) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/nodes/")
	id, _ := strconv.Atoi(idStr)
	switch r.Method {
	case "POST":
		var in struct {
			Name string `json:"name"`
			Host string `json:"host"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		if in.Name == "" {
			errJSON(w, 400, "نام الزامی است")
			return
		}
		s.st.mu.Lock()
		n := Node{ID: s.st.d.NextNodeID, Name: in.Name, Host: in.Host, Token: randStr(48)}
		s.st.d.NextNodeID++
		s.st.d.Nodes = append(s.st.d.Nodes, n)
		s.st.ensurePrivatePorts()
		_ = s.st.save()
		out := nodeOut(n)
		out["token"] = n.Token
		s.st.mu.Unlock()
		writeJSON(w, 200, out)
	case "DELETE":
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		s.st.mu.Lock()
		kept := s.st.d.Nodes[:0]
		for _, n := range s.st.d.Nodes {
			if n.ID != id {
				kept = append(kept, n)
			}
		}
		s.st.d.Nodes = kept
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
	default:
		errJSON(w, 405, "مجاز نیست")
	}
}

// ---------- تونل‌ها ----------

func normTransport(tr string) string {
	switch tr {
	case "tcpmux", "ws", "wss", "quic", "kcp", "auto", "private":
		return tr
	}
	return "tcp"
}

func normProfile(p string) string {
	switch p {
	case "gaming", "ultraspeed":
		return p
	}
	return "balanced"
}

func publicHost(n Node) string {
	if n.Host != "" {
		return n.Host
	}
	if n.ObservedIP != "" {
		return n.ObservedIP
	}
	return n.ReportedIP
}

func (s *Server) tunnels(w http.ResponseWriter, r *http.Request, u User) {
	switch r.Method {
	case "GET":
		s.st.mu.Lock()
		out := []map[string]any{}
		for _, t := range s.st.d.Tunnels {
			_pms, _ := parsePorts(t.Ports)
			pc := len(_pms)
			pl := []map[string]int{}
			for _, pm := range _pms {
				pl = append(pl, map[string]int{"listen": pm[0], "target": pm[1]})
			}
			en, _ := s.st.Node(t.SourceNodeID)
			ex, _ := s.st.Node(t.DestNodeID)
			host := publicHost(en)
			addr := host + ":" + portDisplay(t)
			out = append(out, map[string]any{
				"id": t.ID, "name": t.Name, "type": t.Type, "protocol": t.Protocol,
				"source_node_id": t.SourceNodeID, "dest_node_id": t.DestNodeID,
				"transport": t.Transport, "profile": t.Profile, "ports": t.Ports,
				"port_count": pc, "port_list": pl,
				"target_host": t.TargetHost, "active": t.Active, "bytes": t.Bytes,
				"entry_name": en.Name, "exit_name": ex.Name,
				"listen_addr": addr, "connected": tunnelConnected(en, ex, t.ID),
			})
		}
		s.st.mu.Unlock()
		writeJSON(w, 200, out)
	case "POST":
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		var in struct {
			Name          string `json:"name"`
			Type          string `json:"type"`
			Protocol      string `json:"protocol"`
			Transport     string `json:"transport"`
			Profile       string `json:"profile"`
			SourceNodeID  int    `json:"source_node_id"`
			DestNodeID    int    `json:"dest_node_id"`
			Ports         string `json:"ports"`
			TargetHost    string `json:"target_host"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			errJSON(w, 400, "درخواست نامعتبر")
			return
		}
		if in.Name == "" || in.SourceNodeID == 0 || in.DestNodeID == 0 {
			errJSON(w, 400, "نام و دو سرور الزامی است")
			return
		}
		if in.SourceNodeID == in.DestNodeID {
			errJSON(w, 400, "سرور ورودی و خروجی نمی‌تواند یکی باشد")
			return
		}
		if in.Type == "" {
			in.Type = "reverse"
		}
		if in.Protocol == "" {
			in.Protocol = "tcp"
		}
		if in.TargetHost == "" {
			in.TargetHost = "127.0.0.1"
		}
		pms, perr := parsePorts(in.Ports)
		if perr != nil {
			errJSON(w, 400, perr.Error())
			return
		}
		s.st.mu.Lock()
		if len(pms) == 0 && in.Ports == "" {
			// خودکار: یک پورت آزاد از ۳۰۸۰ به بعد
			in.Ports = strconv.Itoa(s.freePort(in.SourceNodeID, 0))
			_, _ = parsePorts(in.Ports)
		}
		if conf := s.conflictingPorts(in.SourceNodeID, 0, pms); len(conf) > 0 {
			s.st.mu.Unlock()
			errJSON(w, 400, "پورت‌های "+strings.Trim(strings.Join(strings.Fields(fmt.Sprint(conf)), "، "), "[]")+" روی این سرور قبلاً به تونل دیگری داده شده‌اند")
			return
		}
		
		t := Tunnel{
			ID: s.st.d.NextTunID, Name: in.Name, Type: in.Type, Protocol: in.Protocol,
			Transport: normTransport(in.Transport), Profile: normProfile(in.Profile),
			SourceNodeID: in.SourceNodeID, DestNodeID: in.DestNodeID, Ports: in.Ports,
			TargetHost: in.TargetHost, Token: randStr(48), Active: true, CreatedAt: nowStr(),
		}
		s.st.d.NextTunID++
		s.st.d.Tunnels = append(s.st.d.Tunnels, t)
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"id": t.ID, "ok": true})
	default:
		errJSON(w, 405, "مجاز نیست")
	}
}

func portDisplay(t Tunnel) string {
	pms, err := parsePorts(t.Ports)
	if err != nil || len(pms) == 0 {
		return "خودکار"
	}
	if len(pms) <= 3 {
		parts := []string{}
		for _, pm := range pms {
			if pm[0] == pm[1] {
				parts = append(parts, strconv.Itoa(pm[0]))
			} else {
				parts = append(parts, strconv.Itoa(pm[0])+"="+strconv.Itoa(pm[1]))
			}
		}
		return strings.Join(parts, "، ")
	}
	return strconv.Itoa(len(pms)) + " پورت"
}

func (s *Server) tunnelOps(w http.ResponseWriter, r *http.Request, u User) {
	id, _ := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/api/tunnels/"))
	if r.Method == "PUT" {
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		var in struct {
			Name       string `json:"name"`
			Transport  string `json:"transport"`
			Profile    string `json:"profile"`
			Protocol   string `json:"protocol"`
			Ports      string `json:"ports"`
			TargetHost string `json:"target_host"`
			Active     *bool  `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			errJSON(w, 400, "درخواست نامعتبر")
			return
		}
		s.st.mu.Lock()
		defer s.st.mu.Unlock()
		idx := -1
		for i := range s.st.d.Tunnels {
			if s.st.d.Tunnels[i].ID == id {
				idx = i
				break
			}
		}
		if idx < 0 {
			errJSON(w, 404, "تونل پیدا نشد")
			return
		}
		cur := s.st.d.Tunnels[idx]
		if in.Name != "" {
			cur.Name = in.Name
		}
		if in.Transport != "" {
			cur.Transport = normTransport(in.Transport)
		}
		if in.Profile != "" {
			cur.Profile = normProfile(in.Profile)
		}
		if in.Protocol != "" {
			cur.Protocol = in.Protocol
		}
		if in.TargetHost != "" {
			cur.TargetHost = in.TargetHost
		}
		if in.Active != nil {
			cur.Active = *in.Active
		}
		cur.Ports = in.Ports
		pms, perr := parsePorts(cur.Ports)
		if perr != nil {
			errJSON(w, 400, perr.Error())
			return
		}
		if conf := s.conflictingPorts(cur.SourceNodeID, cur.ID, pms); len(conf) > 0 {
			errJSON(w, 400, "پورت‌های "+strings.Trim(strings.Join(strings.Fields(fmt.Sprint(conf)), "، "), "[]")+" روی این سرور قبلاً به تونل دیگری داده شده‌اند")
			return
		}
		s.st.d.Tunnels[idx] = cur
		_ = s.st.save()
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	if r.Method == "DELETE" {
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		s.st.mu.Lock()
		kept := s.st.d.Tunnels[:0]
		for _, t := range s.st.d.Tunnels {
			if t.ID != id {
				kept = append(kept, t)
			}
		}
		s.st.d.Tunnels = kept
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	errJSON(w, 405, "مجاز نیست")
}

// ---------- کاربران ----------

func (s *Server) users(w http.ResponseWriter, r *http.Request, u User) {
	switch r.Method {
	case "GET":
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		s.st.mu.Lock()
		defer s.st.mu.Unlock()
		out := []map[string]any{}
		for _, x := range s.st.d.Users {
			out = append(out, map[string]any{"id": x.ID, "username": x.Username, "role": x.Role, "is_active": x.IsActive, "created_at": x.CreatedAt})
		}
		writeJSON(w, 200, out)
	case "POST":
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Username == "" || in.Password == "" {
			errJSON(w, 400, "نام کاربری و رمز عبور الزامی است")
			return
		}
		if in.Role == "" {
			in.Role = "user"
		}
		s.st.mu.Lock()
		if _, exists := s.st.UserByName(in.Username); exists {
			s.st.mu.Unlock()
			errJSON(w, 400, "این نام کاربری وجود دارد")
			return
		}
		nu := User{ID: s.st.d.NextUserID, Username: in.Username, PasswordHash: hashPassword(in.Password, in.Username), Role: in.Role, IsActive: true, CreatedAt: nowStr()}
		s.st.d.NextUserID++
		s.st.d.Users = append(s.st.d.Users, nu)
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"id": nu.ID, "ok": true})
	default:
		errJSON(w, 405, "مجاز نیست")
	}
}

func (s *Server) userOps(w http.ResponseWriter, r *http.Request, u User) {
	id, _ := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/api/users/"))
	if r.Method == "DELETE" {
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		if id == u.ID {
			errJSON(w, 400, "نمی‌توانی خودت را حذف کنی")
			return
		}
		s.st.mu.Lock()
		kept := s.st.d.Users[:0]
		for _, x := range s.st.d.Users {
			if x.ID != id {
				kept = append(kept, x)
			}
		}
		s.st.d.Users = kept
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	errJSON(w, 405, "مجاز نیست")
}

// ---------- تنظیمات و به‌روزرسانی ----------

func (s *Server) settings(w http.ResponseWriter, r *http.Request, u User) {
	switch r.Method {
	case "GET":
		s.st.mu.Lock()
		defer s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{
			"version": Version, "nodes": len(s.st.d.Nodes), "tunnels": len(s.st.d.Tunnels),
			"private_sni": s.st.d.PrivateSNI,
		})
	case "POST":
		if u.Role != "admin" {
			errJSON(w, 403, "فقط مدیر")
			return
		}
		var in struct {
			PrivateSNI string `json:"private_sni"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		s.st.mu.Lock()
		if in.PrivateSNI != "" {
			s.st.d.PrivateSNI = in.PrivateSNI
		}
		_ = s.st.save()
		s.st.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
	default:
		errJSON(w, 405, "مجاز نیست")
	}
}

func (s *Server) update(w http.ResponseWriter, r *http.Request, u User) {
	writeJSON(w, 200, map[string]any{"message": "به‌روزرسانی بعد از انتشار نسخه بعدی فعال می‌شود"})
}

// ---------- تست اتصال ----------

func (s *Server) linktest(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method != "POST" {
		errJSON(w, 405, "مجاز نیست")
		return
	}
	var in struct {
		SourceNodeID int `json:"source_node_id"`
		DestNodeID   int `json:"dest_node_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.SourceNodeID == 0 || in.DestNodeID == 0 {
		errJSON(w, 400, "هر دو سرور را انتخاب کن")
		return
	}
	if in.SourceNodeID == in.DestNodeID {
		errJSON(w, 400, "سرور ورودی و خروجی یکی است")
		return
	}
	s.mu.Lock()
	s.seq++
	p := &Probe{ID: s.seq, SrcID: in.SourceNodeID, DstID: in.DestNodeID, Token: randStr(32), Created: time.Now()}
	s.probes[p.ID] = p
	s.mu.Unlock()
	writeJSON(w, 200, map[string]any{"probe_id": p.ID})
}

func (s *Server) linktestGet(w http.ResponseWriter, r *http.Request, u User) {
	id, _ := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/api/linktest/"))
	s.mu.Lock()
	p := s.probes[id]
	s.mu.Unlock()
	if p == nil {
		errJSON(w, 404, "تست یافت نشد")
		return
	}
	s.mu.Lock()
	done := p.Final || time.Since(p.Created) > 75*time.Second
	suggested := ""
	bestRtt := int64(0)
	for _, x := range p.Results {
		if !x.OK {
			continue
		}
		if suggested == "" || x.RTTms < bestRtt {
			suggested, bestRtt = x.Transport, x.RTTms
		}
	}
	res := p.Results
	final := p.Final
	s.mu.Unlock()
	writeJSON(w, 200, map[string]any{"done": done, "final": final, "results": res, "suggested": suggested})
}

func observedIP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return ""
	}
	return ip
}
