package main

// ذخیره‌سازی JSON ساده روی دیسک - بدون نیاز به دیتابیس خارجی

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
	Role         string `json:"role"`
	IsActive     bool   `json:"is_active"`
	CreatedAt    string `json:"created_at"`
}

type Node struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Host         string  `json:"host"`
	ObservedIP   string  `json:"observed_ip"`
	ReportedIP   string  `json:"reported_ip"`
	Token        string  `json:"token"`
	AgentVersion string  `json:"agent_version"`
	OSInfo       string  `json:"os_info"`
	RelayPort    int     `json:"relay_port"`
	PrivatePort  int     `json:"private_port"`
	LastSeen     string  `json:"last_seen"`
	Online       bool    `json:"online"`
	CPUPercent   float64 `json:"cpu_percent"`
	MemUsedBytes int64   `json:"mem_used_bytes"`
	MemTotalByte int64   `json:"mem_total_bytes"`
	Links        []Link  `json:"links"`
}

type Link struct {
	TunnelID   int    `json:"tunnel_id"`
	Side       string `json:"side"`
	Transports []Tr   `json:"transports"`
	At         string `json:"at"`
}

type Tr struct {
	Name    string `json:"name"`
	Up      bool   `json:"up"`
	RTTms   int64  `json:"rtt_ms"`
	LastErr string `json:"last_err"`
}

type Tunnel struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Protocol     string `json:"protocol"`
	Transport    string `json:"transport"`
	Profile      string `json:"profile"`
	SourceNodeID int    `json:"source_node_id"`
	DestNodeID   int    `json:"dest_node_id"`
	Ports        string `json:"ports"`
	TargetHost   string `json:"target_host"`
	Token        string `json:"token"`
	Active       bool   `json:"active"`
	CreatedAt    string `json:"created_at"`
	Bytes        int64  `json:"bytes"`
}

type Data struct {
	Secret        string   `json:"secret"`
	NextUserID    int      `json:"next_user_id"`
	NextNodeID    int      `json:"next_node_id"`
	NextTunID     int      `json:"next_tunnel_id"`
	Users         []User   `json:"users"`
	Nodes         []Node   `json:"nodes"`
	Tunnels       []Tunnel `json:"tunnels"`
	PrivateKeyHex string   `json:"private_key_hex"`
	Samples       []int64  `json:"samples"`
	LastSample    int64    `json:"last_sample"`
	PrivateSNI    string   `json:"private_sni"`
}

type Store struct {
	mu   sync.Mutex
	path string
	d    Data
}

var ErrNotFound = errors.New("یافت نشد")

func nowStr() string { return time.Now().UTC().Format(time.RFC3339) }

func hashPassword(pw string, salt string) string {
	h := sha256.Sum256([]byte(salt + "|" + pw))
	return hex.EncodeToString(h[:])
}

func (u *User) Check(pw string) bool {
	want := hashPassword(pw, u.Username)
	return subtle.ConstantTimeCompare([]byte(want), []byte(u.PasswordHash)) == 1
}

func randStr(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

func Open(path string) (*Store, error) {
	s := &Store{path: path}
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &s.d)
	}
	if s.d.Secret == "" {
		s.d.Secret = randStr(32)
	}
	if len(s.d.Users) == 0 {
		s.d.NextUserID = 2
		s.d.Users = []User{{ID: 1, Username: "admin", PasswordHash: hashPassword("admin123", "admin"), Role: "admin", IsActive: true, CreatedAt: nowStr()}}
	} else if s.d.NextUserID == 0 {
		s.d.NextUserID = 2
	}
	if s.d.NextNodeID == 0 {
		s.d.NextNodeID = 1
	}
	if s.d.NextTunID == 0 {
		s.d.NextTunID = 1
	}
	if s.d.PrivateSNI == "" {
		s.d.PrivateSNI = "www.cloudflare.com"
	}
	if s.d.PrivateKeyHex == "" {
		b := make([]byte, 32)
		_, _ = rand.Read(b)
		s.d.PrivateKeyHex = hex.EncodeToString(b)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil && filepath.Dir(path) != "." {
		return nil, err
	}
	return s, s.save()
}

func (s *Store) save() error {
	b, err := json.MarshalIndent(s.d, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Store) Save() error { s.mu.Lock(); defer s.mu.Unlock(); return s.save() }

// totalBytes مجموع ترافیک همهٔ تونل‌ها
func (s *Store) totalBytes() int64 {
	var t int64
	for _, x := range s.d.Tunnels {
		t += x.Bytes
	}
	return t
}

// sample هر دقیقه مقدار ترافیکِ گذشته را ثبت می‌کند (دادهٔ واقعیِ نمودار)
func (s *Store) sample() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.totalBytes()
	delta := now - s.d.LastSample
	if delta < 0 {
		delta = 0
	}
	s.d.LastSample = now
	s.d.Samples = append(s.d.Samples, delta)
	if len(s.d.Samples) > 12 {
		s.d.Samples = s.d.Samples[len(s.d.Samples)-12:]
	}
	_ = s.save()
}

func (s *Store) StartSampler() {
	go func() {
		for {
			time.Sleep(60 * time.Second)
			s.sample()
		}
	}()
}

func (s *Store) Node(id int) (Node, bool) {
	for _, n := range s.d.Nodes {
		if n.ID == id {
			return n, true
		}
	}
	return Node{}, false
}

func (s *Store) Tunnel(id int) (Tunnel, bool) {
	for _, t := range s.d.Tunnels {
		if t.ID == id {
			return t, true
		}
	}
	return Tunnel{}, false
}

func (s *Store) UserByName(name string) (User, bool) {
	for _, u := range s.d.Users {
		if u.Username == name {
			return u, true
		}
	}
	return User{}, false
}
