package main

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed all:dist
var webFS embed.FS

const Version = "1.0.0"

type Server struct {
	st  *Store
	mu  sync.Mutex
	seq int
	probes map[int]*Probe
}

type Probe struct {
	ID      int
	SrcID   int
	DstID   int
	Token   string
	Created time.Time
	Final   bool
	Results []ProbeResult
}

type ProbeResult struct {
	Transport string `json:"transport"`
	OK        bool   `json:"ok"`
	RTTms     int64  `json:"rtt_ms"`
	Error     string `json:"error"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("شیوهٔ استفاده:")
		fmt.Println("  gozar serve --addr 0.0.0.0:8080 --data /etc/gozar/data.json")
		fmt.Println("  gozar agent --panel http://IP:8080 --token TOKEN")
		fmt.Println("  gozar version")
		os.Exit(1)
	}
	switch os.Args[1] {
	case "version":
		fmt.Println("gozar", Version)
	case "serve":
		serveCmd(os.Args[2:])
	case "agent":
		fmt.Println("ایجنتِ گذر هنوز در این نسخه فعال نیست.")
		fmt.Println("نسخهٔ ۱.۰.۰ فقط پنل مدیریت را دارد؛ بخش انتقال ترافیک در حال ساخت است.")
		os.Exit(1)
	default:
		fmt.Println("دستور نامعلوم:", os.Args[1])
		os.Exit(1)
	}
}

func arg(flags []string, name, def string) string {
	for i := 0; i+1 < len(flags); i++ {
		if flags[i] == name {
			return flags[i+1]
		}
	}
	return def
}

func serveCmd(flags []string) {
	addr := arg(flags, "--addr", "0.0.0.0:8080")
	data := arg(flags, "--data", "/etc/gozar/data.json")
	st, err := Open(data)
	if err != nil {
		fmt.Println("خطا در باز کردن داده‌ها:", err)
		os.Exit(1)
	}
	warnDefaultAdmin(st)
	st.StartSampler()
	s := &Server{st: st, probes: map[int]*Probe{}}
	fmt.Printf("[*] گذر v%s روی %s آماده است\n", Version, addr)
	if err := http.ListenAndServe(addr, s.routes()); err != nil {
		fmt.Println("خطا:", err)
		os.Exit(1)
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", s.login)
	mux.HandleFunc("/api/me", s.auth(s.me))
	mux.HandleFunc("/api/stats", s.auth(s.stats))
	mux.HandleFunc("/api/nodes", s.auth(s.nodes))
	mux.HandleFunc("/api/nodes/", s.auth(s.nodeOps))
	mux.HandleFunc("/api/tunnels", s.auth(s.tunnels))
	mux.HandleFunc("/api/tunnels/", s.auth(s.tunnelOps))
	mux.HandleFunc("/api/users", s.auth(s.users))
	mux.HandleFunc("/api/users/", s.auth(s.userOps))
	mux.HandleFunc("/api/linktest", s.auth(s.linktest))
	mux.HandleFunc("/api/linktest/", s.auth(s.linktestGet))
	mux.HandleFunc("/api/settings", s.auth(s.settings))
	mux.HandleFunc("/api/update", s.auth(s.update))
	mux.HandleFunc("/api/agent/register", s.agent(s.agentRegister))
	mux.HandleFunc("/api/agent/config", s.agent(s.agentConfig))
	mux.HandleFunc("/api/agent/heartbeat", s.agent(s.agentHeartbeat))
	mux.HandleFunc("/api/agent/binary", s.agentBinary)
	// فایل‌های رابط کاربری
	sub, _ := fs.Sub(webFS, "dist")
	mux.Handle("/", http.FileServer(http.FS(sub)))
	return mux
}

// ---------- ابزارها ----------

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func errJSON(w http.ResponseWriter, code int, msg string) { writeJSON(w, code, map[string]any{"detail": msg}) }

func (s *Server) auth(h func(http.ResponseWriter, *http.Request, User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, ok := s.userFromRequest(r)
		if !ok {
			errJSON(w, 401, "نیاز به ورود")
			return
		}
		h(w, r, u)
	}
}

func (s *Server) userFromRequest(r *http.Request) (User, bool) {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if tok == "" {
		return User{}, false
	}
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	for _, u := range s.st.d.Users {
		if !u.IsActive {
			continue
		}
		if subtleEqual(tokenFor(u, s.st.d.Secret), tok) {
			return u, true
		}
	}
	return User{}, false
}

func subtleEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	diff := 0
	for i := range a {
		diff |= int(a[i]) ^ int(b[i])
	}
	return diff == 0
}

func tokenFor(u User, secret string) string {
	h := sha256.Sum256([]byte(u.Username + "|" + u.PasswordHash + "|" + secret))
	return hex.EncodeToString(h[:])
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		errJSON(w, 400, "درخواست نامعتبر")
		return
	}
	s.st.mu.Lock()
	u, ok := s.st.UserByName(in.Username)
	s.st.mu.Unlock()
	if !ok || !u.IsActive || !u.Check(in.Password) {
		errJSON(w, 401, "نام کاربری یا رمز عبور اشتباه است")
		return
	}
	s.st.mu.Lock()
	tok := tokenFor(u, s.st.d.Secret)
	s.st.mu.Unlock()
	writeJSON(w, 200, map[string]any{"token": tok})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request, u User) {
	writeJSON(w, 200, map[string]any{"id": u.ID, "username": u.Username, "role": u.Role})
}

// warnDefaultAdmin اگر رمز مدیر هنوز پیش‌فرض باشد هشدار می‌دهد
func warnDefaultAdmin(st *Store) {
	st.mu.Lock()
	defer st.mu.Unlock()
	for _, u := range st.d.Users {
		if u.Username != "admin" {
			continue
		}
		if u.PasswordHash == hashPassword("admin123", "admin") {
			fmt.Println("--------------------------------------------------")
			fmt.Println("هشدار امنیتی: رمز مدیر هنوز پیش‌فرض است (admin/admin123)")
			fmt.Println("حتماً از بخش «کاربران» آن را تغییر بده.")
			fmt.Println("--------------------------------------------------")
		}
		return
	}
}
