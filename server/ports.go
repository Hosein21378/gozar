package main

import (
	"errors"
	"sort"
	"strconv"
	"strings"
)

// PortMap یک پورت را نگه می‌دارد: [0]=پورت گوش‌دادن روی سرور ورودی، [1]=پورت مقصد روی سرور خروجی
type PortMap [2]int

const maxPortsPerTunnel = 256

var errBadPort = errors.New("پورت نامعتبر")

// parsePorts رشتهٔ پورت‌ها را به فهرستی از پورت‌ها تبدیل می‌کند.
// قالب‌های پشتیبانی‌شده:
//   80,443,8080          چند پورت جدا
//   8000-8010            بازه (شامل هر دو سر)
//   2053=53              نگاشت: روی 2053 گوش بده، به 53 بفرست
//   8443=443,9443=443    چند نگاشت
// خالی = تخصیص خودکار
func parsePorts(spec string) ([]PortMap, error) {
	spec = strings.TrimSpace(spec)
	if spec == "" {
		return nil, nil // خودکار
	}
	out := []PortMap{}
	seen := map[int]bool{}
	add := func(listen, target int) error {
		if listen < 1 || listen > 65535 || target < 1 || target > 65535 {
			return errBadPort
		}
		if seen[listen] {
			return errors.New("پورت " + strconv.Itoa(listen) + " دو بار تکرار شده")
		}
		seen[listen] = true
		out = append(out, PortMap{listen, target})
		return nil
	}
	for _, part := range strings.Split(spec, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		switch {
		case strings.Contains(part, "="):
			kv := strings.SplitN(part, "=", 2)
			l, ok1 := atoiStrict(kv[0])
			t, ok2 := atoiStrict(kv[1])
			if !ok1 || !ok2 {
				return nil, errors.New("نگاشت نامعتبر: «" + part + "» — قالب درست: 2053=53")
			}
			if err := add(l, t); err != nil {
				return nil, err
			}
		case strings.Contains(part, "-"):
			rg := strings.SplitN(part, "-", 2)
			a, ok1 := atoiStrict(rg[0])
			b, ok2 := atoiStrict(rg[1])
			if !ok1 || !ok2 {
				return nil, errors.New("بازهٔ نامعتبر: «" + part + "» — قالب درست: 8000-8010")
			}
			if a > b {
				return nil, errors.New("بازه برعکس است: «" + part + "»")
			}
			if b-a > 200 {
				return nil, errors.New("بازهٔ «" + part + "» خیلی بزرگ است (حداکثر ۲۰۰ پورت)")
			}
			for p := a; p <= b; p++ {
				if err := add(p, p); err != nil {
					return nil, err
				}
			}
		default:
			p, ok := atoiStrict(part)
			if !ok {
				return nil, errors.New("«" + part + "» یک پورت معتبر نیست (باید عددی بین ۱ تا ۶۵۵۳۵ باشد)")
			}
			if err := add(p, p); err != nil {
				return nil, err
			}
		}
		if len(out) > maxPortsPerTunnel {
			return nil, errors.New("تعداد پورت‌ها زیاد است (حداکثر " + strconv.Itoa(maxPortsPerTunnel) + " پورت در هر تونل)")
		}
	}
	return out, nil
}

func atoiStrict(s string) (int, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return v, true
}

// portCountWithoutParse فقط برای نمایش سریعِ تعداد است
func portLabel(pms []PortMap) string {
	if len(pms) == 0 {
		return "خودکار"
	}
	if len(pms) == 1 {
		return strconv.Itoa(pms[0][0])
	}
	return strconv.Itoa(len(pms)) + " پورت"
}

// conflictingPorts پورت‌هایی را برمی‌گرداند که با تونل‌های دیگرِ همین سرور ورودی تداخل دارند
func (s *Server) conflictingPorts(nodeID, skipTunID int, pms []PortMap) []int {
	if len(pms) == 0 {
		return nil
	}
	want := map[int]bool{}
	for _, pm := range pms {
		want[pm[0]] = true
	}
	hit := []int{}
	for _, t := range s.st.d.Tunnels {
		if !t.Active || t.ID == skipTunID || t.SourceNodeID != nodeID {
			continue
		}
		other, err := parsePorts(t.Ports)
		if err != nil {
			continue
		}
		for _, pm := range other {
			if want[pm[0]] {
				hit = append(hit, pm[0])
			}
		}
	}
	sort.Ints(hit)
	// حذف تکراری‌ها
	uniq := []int{}
	for i, v := range hit {
		if i == 0 || v != hit[i-1] {
			uniq = append(uniq, v)
		}
	}
	return uniq
}

// freePort یک پورت آزاد روی سرور ورودی پیدا می‌کند
func (s *Server) freePort(nodeID, skipTunID int) int {
	used := map[int]bool{}
	for _, t := range s.st.d.Tunnels {
		if !t.Active || t.SourceNodeID != nodeID || t.ID == skipTunID {
			continue
		}
		pms, err := parsePorts(t.Ports)
		if err != nil {
			continue
		}
		for _, pm := range pms {
			used[pm[0]] = true
		}
	}
	for p := 3080; p < 65000; p++ {
		if !used[p] {
			return p
		}
	}
	return 3080
}
