// Banner generation module for standalone SVG social cards

pub fn escape_xml(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

pub fn wrap_text_lines(text: &str, max_chars_per_line: usize, max_lines: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return lines;
    }

    let mut current_line = String::new();
    for (i, word) in words.iter().enumerate() {
        if lines.len() == max_lines - 1
            && !current_line.is_empty()
            && current_line.len() + 1 + word.len() > max_chars_per_line
        {
            current_line.push_str("...");
            lines.push(current_line);
            current_line = String::new();
            break;
        }

        if current_line.is_empty() {
            current_line.push_str(word);
        } else if current_line.len() + 1 + word.len() <= max_chars_per_line {
            current_line.push(' ');
            current_line.push_str(word);
        } else {
            lines.push(current_line);
            if lines.len() >= max_lines {
                current_line = String::new();
                break;
            }
            current_line = word.to_string();
        }

        if i == words.len() - 1 && !current_line.is_empty() && lines.len() < max_lines {
            lines.push(current_line.clone());
            current_line.clear();
        }
    }

    if !current_line.is_empty() && lines.len() < max_lines {
        lines.push(current_line);
    }

    lines
}

pub struct BannerThemeColors {
    pub primary_accent: &'static str,
    pub secondary_accent: &'static str,
    pub badge_bg: &'static str,
    pub badge_border: &'static str,
    pub badge_text: &'static str,
    pub glow_color: &'static str,
}

pub fn resolve_theme(theme_name: Option<&str>, category: &str) -> BannerThemeColors {
    let key = match theme_name {
        Some(t) if !t.is_empty() => t.to_lowercase(),
        _ => match category.to_lowercase().as_str() {
            "benchmark" | "benchmarks" | "performance" | "metrics" => "emerald".to_string(),
            "multi-agent" | "agent" | "ecosystem" | "autonomous" => "violet".to_string(),
            "tutorial" | "guide" | "how-to" | "walkthrough" => "amber".to_string(),
            _ => "cyan".to_string(),
        },
    };

    match key.as_str() {
        "emerald" | "midnight-emerald" | "green" => BannerThemeColors {
            primary_accent: "#10b981",
            secondary_accent: "#059669",
            badge_bg: "rgba(16, 185, 129, 0.15)",
            badge_border: "#059669",
            badge_text: "#34d399",
            glow_color: "#10b981",
        },
        "violet" | "indigo-violet" | "purple" => BannerThemeColors {
            primary_accent: "#8b5cf6",
            secondary_accent: "#6366f1",
            badge_bg: "rgba(139, 92, 246, 0.15)",
            badge_border: "#7c3aed",
            badge_text: "#a78bfa",
            glow_color: "#8b5cf6",
        },
        "amber" | "amber-glow" | "yellow" | "orange" => BannerThemeColors {
            primary_accent: "#f59e0b",
            secondary_accent: "#d97706",
            badge_bg: "rgba(245, 158, 11, 0.15)",
            badge_border: "#d97706",
            badge_text: "#fbbf24",
            glow_color: "#f59e0b",
        },
        _ => BannerThemeColors {
            primary_accent: "#06b6d4",
            secondary_accent: "#3b82f6",
            badge_bg: "rgba(6, 182, 212, 0.15)",
            badge_border: "#0891b2",
            badge_text: "#22d3ee",
            glow_color: "#06b6d4",
        },
    }
}

pub fn generate_hero_banner_svg(
    title: &str,
    category: &str,
    summary: &str,
    theme: Option<&str>,
) -> String {
    let colors = resolve_theme(theme, category);
    let title_clean = if title.trim().is_empty() {
        "Ivy Autonomous Growth"
    } else {
        title.trim()
    };
    let category_clean = if category.trim().is_empty() {
        "Architecture"
    } else {
        category.trim()
    };
    let category_upper = category_clean.to_uppercase();
    let safe_category = escape_xml(&category_upper);
    let title_lines = wrap_text_lines(title_clean, 34, 3);

    let truncated_summary = if summary.trim().is_empty() {
        String::new()
    } else {
        let trimmed = summary.trim();
        if trimmed.chars().count() > 120 {
            format!("{}...", trimmed.chars().take(117).collect::<String>())
        } else {
            trimmed.to_string()
        }
    };
    let safe_summary = escape_xml(&truncated_summary);

    let badge_char_count = safe_category.len();
    let badge_width = (badge_char_count * 10 + 36).max(110);
    let badge_text_x = 80 + badge_width / 2;

    let mut title_tspans = String::new();
    let title_start_y = 210;
    let line_height = 62;
    for (idx, line) in title_lines.iter().enumerate() {
        let safe_line = escape_xml(line);
        let y_pos = title_start_y + idx * line_height;
        title_tspans.push_str(&format!(
            r##"    <text x="80" y="{y_pos}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" font-weight="800" fill="#f8fafc" letter-spacing="-0.5">{safe_line}</text>
"##
        ));
    }

    let summary_y = title_start_y + (title_lines.len().max(1) * line_height) + 15;
    let summary_element = if !safe_summary.is_empty() {
        format!(
            r##"    <text x="80" y="{summary_y}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="400" fill="#94a3b8" letter-spacing="0.2">{safe_summary}</text>"##
        )
    } else {
        String::new()
    };

    format!(
r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bg-glow" cx="75%" cy="30%" r="65%">
      <stop offset="0%" stop-color="{glow_color}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{primary_accent}" />
      <stop offset="100%" stop-color="{secondary_accent}" />
    </linearGradient>
    <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1" stroke-opacity="0.35" />
    </pattern>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="#020617" />
  <rect width="1200" height="630" fill="url(#grid-pattern)" />
  <rect width="1200" height="630" fill="url(#bg-glow)" />

  <!-- Frame Border -->
  <rect x="16" y="16" width="1168" height="598" rx="16" fill="none" stroke="#1e293b" stroke-width="2" />
  <rect x="16" y="16" width="1168" height="4" rx="2" fill="url(#accent-grad)" />

  <!-- Header Section: Category Badge and Ivy Brand -->
  <g id="header">
    <rect x="80" y="65" width="{badge_width}" height="36" rx="18" fill="{badge_bg}" stroke="{badge_border}" stroke-width="1.5" />
    <text x="{badge_text_x}" y="88" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" fill="{badge_text}" text-transform="uppercase">{safe_category}</text>

    <g id="brand-logo" transform="translate(1030, 65)">
      <rect width="90" height="36" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="18" r="6" fill="{primary_accent}" />
      <text x="36" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800" fill="#f8fafc" letter-spacing="1">IVY</text>
    </g>
  </g>

  <!-- Title and Summary -->
  <g id="content">
{title_tspans}
{summary_element}
  </g>

  <!-- Footer Divider and Metadata -->
  <g id="footer">
    <line x1="80" y1="540" x2="1120" y2="540" stroke="#1e293b" stroke-width="1" />
    <text x="80" y="575" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#64748b" letter-spacing="0.5">ivy.interactive/blog</text>
    <text x="1120" y="575" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500" fill="#475569">Autonomous Growth Engine</text>
  </g>
</svg>
"##,
        glow_color = colors.glow_color,
        primary_accent = colors.primary_accent,
        secondary_accent = colors.secondary_accent,
        badge_width = badge_width,
        badge_bg = colors.badge_bg,
        badge_border = colors.badge_border,
        badge_text_x = badge_text_x,
        badge_text = colors.badge_text,
        safe_category = safe_category,
        title_tspans = title_tspans,
        summary_element = summary_element,
    )
}
