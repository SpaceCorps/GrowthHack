mod common;

use chrono::Utc;
use growthhack_backend::api::demos::{
    build_default_automation_config, build_default_platform_copy, build_default_scenes,
    parse_demo_package, resolve_generator_path,
};
use growthhack_backend::db::{
    AutomationConfig, GrowthState, PlatformCopy, StoryboardScene, VideoDemo,
};

#[test]
fn test_video_demo_serde_roundtrip() {
    let now = Utc::now();
    let demo = VideoDemo {
        id: "demo-custom-1".to_string(),
        feature: "Git Worktrees".to_string(),
        target_platform: "LinkedIn".to_string(),
        duration_seconds: 30,
        headline: "Stop Agent Conflicts With Git Worktrees".to_string(),
        body: "Concurrent agents require isolated environments.".to_string(),
        storyboard: "00:00 - 00:05 Hook\n00:05 - 00:30 Tour".to_string(),
        status: "Pending".to_string(),
        created_at: now,
        updated_at: now,
        scenes: vec![
            StoryboardScene {
                stage: "Hook".to_string(),
                start_second: 0,
                end_second: 5,
                title: "Collision".to_string(),
                visual_action: "Split terminal showing index lock error".to_string(),
                playwright_action: Some("await page.goto('/terminal');".to_string()),
            },
            StoryboardScene {
                stage: "WorktreeIsolation".to_string(),
                start_second: 5,
                end_second: 15,
                title: "Provisioning".to_string(),
                visual_action: "Tendril spins up worktree".to_string(),
                playwright_action: Some("await page.click('#spawn');".to_string()),
            },
            StoryboardScene {
                stage: "TestVerification".to_string(),
                start_second: 15,
                end_second: 25,
                title: "Verification".to_string(),
                visual_action: "Parallel test verification".to_string(),
                playwright_action: Some("await page.click('#test');".to_string()),
            },
            StoryboardScene {
                stage: "PrBadgeOutro".to_string(),
                start_second: 25,
                end_second: 30,
                title: "Outro".to_string(),
                visual_action: "PR created with green badge".to_string(),
                playwright_action: Some("await page.screenshot();".to_string()),
            },
        ],
        platform_copy: Some(PlatformCopy {
            linkedin_post: "Hook post content".to_string(),
            twitter_thread: vec![
                "1/3 Thread post 1".to_string(),
                "2/3 Thread post 2".to_string(),
                "3/3 Thread post 3".to_string(),
            ],
            youtube_shorts_caption: "Shorts caption #AI".to_string(),
        }),
        automation_config: Some(AutomationConfig {
            generator_path: "/Users/rorychatt/git/web-demo-generator".to_string(),
            playwright_script: "test('demo', async () => {});".to_string(),
            transcode_format: "mp4".to_string(),
            output_video_path: Some("/tmp/output.mp4".to_string()),
        }),
    };

    let serialized = serde_json::to_string(&demo).expect("Should serialize VideoDemo");
    let deserialized: VideoDemo =
        serde_json::from_str(&serialized).expect("Should deserialize VideoDemo");

    assert_eq!(deserialized.id, "demo-custom-1");
    assert_eq!(deserialized.scenes.len(), 4);
    assert_eq!(deserialized.scenes[0].stage, "Hook");
    assert_eq!(deserialized.scenes[1].stage, "WorktreeIsolation");
    assert_eq!(deserialized.scenes[2].stage, "TestVerification");
    assert_eq!(deserialized.scenes[3].stage, "PrBadgeOutro");

    let copy = deserialized.platform_copy.expect("platform_copy present");
    assert_eq!(copy.linkedin_post, "Hook post content");
    assert_eq!(copy.twitter_thread.len(), 3);
    assert_eq!(copy.youtube_shorts_caption, "Shorts caption #AI");

    let auto = deserialized
        .automation_config
        .expect("automation_config present");
    assert_eq!(
        auto.generator_path,
        "/Users/rorychatt/git/web-demo-generator"
    );
    assert_eq!(auto.transcode_format, "mp4");
}

#[test]
fn test_storyboard_scenes_stages_and_intervals() {
    let scenes = build_default_scenes("Multi-Agent Orchestration", 30);
    assert_eq!(scenes.len(), 4);

    let stages: Vec<&str> = scenes.iter().map(|s| s.stage.as_str()).collect();
    assert_eq!(
        stages,
        vec![
            "Hook",
            "WorktreeIsolation",
            "TestVerification",
            "PrBadgeOutro"
        ]
    );

    // Verify sequential timestamp boundaries
    assert_eq!(scenes[0].start_second, 0);
    assert!(scenes[0].end_second > scenes[0].start_second);

    for i in 1..scenes.len() {
        assert_eq!(scenes[i].start_second, scenes[i - 1].end_second);
        assert!(scenes[i].end_second > scenes[i].start_second);
    }

    assert_eq!(scenes.last().unwrap().end_second, 30);

    // Test a longer duration
    let scenes_45 = build_default_scenes("Issue to Verified PR", 45);
    assert_eq!(scenes_45.last().unwrap().end_second, 45);
}

#[test]
fn test_platform_copy_validation() {
    let copy = build_default_platform_copy(
        "Git Worktrees",
        "Stop Agent Conflicts",
        "Full post body explaining worktree isolation.",
    );

    assert!(copy
        .linkedin_post
        .contains("Full post body explaining worktree isolation."));
    assert!(!copy.twitter_thread.is_empty());
    assert!(copy.twitter_thread[0].starts_with("1/4"));
    assert!(copy.youtube_shorts_caption.contains("Git Worktrees"));
    assert!(copy.youtube_shorts_caption.contains("#Shorts"));
}

#[test]
fn test_web_demo_generator_path_and_transcode_config() {
    let path = resolve_generator_path();
    assert!(!path.is_empty());

    let config_mp4 = build_default_automation_config("Voice Control", Some("mp4".to_string()));
    assert_eq!(config_mp4.transcode_format, "mp4");
    assert!(config_mp4.playwright_script.contains("Voice Control"));
    assert!(config_mp4.playwright_script.contains("@playwright/test"));

    let config_webm = build_default_automation_config("Tunneling", Some("webm".to_string()));
    assert_eq!(config_webm.transcode_format, "webm");
}

#[test]
fn test_parse_demo_package() {
    let raw_output = r#"# Hook: Stop Breaking Main With Unverified Code

SECTION 1: VIRAL LINKEDIN POST COPY
Here is why automated verification saves hours every day.

SECTION 2: SECOND-BY-SECOND VIDEO STORYBOARD
00:00 - 00:05 Hook
00:05 - 00:15 Worktree
00:15 - 00:25 Tests
00:25 - 00:30 PR
"#;

    let (headline, body, storyboard, scenes, copy, config) = parse_demo_package(
        raw_output,
        "Verification Gates",
        "LinkedIn",
        30,
        Some("mp4".to_string()),
    );

    assert_eq!(headline, "Stop Breaking Main With Unverified Code");
    assert!(body.contains("SECTION 1"));
    assert!(storyboard.contains("SECTION 2"));
    assert_eq!(scenes.len(), 4);
    assert_eq!(copy.twitter_thread.len(), 4);
    assert_eq!(config.transcode_format, "mp4");
}

#[test]
fn test_growth_data_json_persistence_roundtrip() {
    let temp_dir = std::env::temp_dir().join("test_demos_persistence_roundtrip");
    let _ = std::fs::create_dir_all(&temp_dir);
    let data_file = temp_dir.join("growth_data.json");

    let state = GrowthState::seed_default();
    assert_eq!(state.video_demos.len(), 5);

    // Verify all 5 seeded demos have 4 scenes and platform copy
    for demo in &state.video_demos {
        assert_eq!(
            demo.scenes.len(),
            4,
            "Demo {} should have 4 scenes",
            demo.id
        );
        assert!(
            demo.platform_copy.is_some(),
            "Demo {} should have platform_copy",
            demo.id
        );
        assert!(
            demo.automation_config.is_some(),
            "Demo {} should have automation_config",
            demo.id
        );
    }

    state
        .save(&data_file)
        .expect("Should save growth state to disk");

    let content = std::fs::read_to_string(&data_file).expect("Should read saved state");
    let loaded: GrowthState = serde_json::from_str(&content).expect("Should parse loaded state");

    assert_eq!(loaded.video_demos.len(), 5);
    assert_eq!(loaded.video_demos[0].scenes.len(), 4);
    assert_eq!(loaded.video_demos[0].scenes[0].stage, "Hook");
    assert_eq!(loaded.video_demos[0].scenes[3].stage, "PrBadgeOutro");

    let copy = loaded.video_demos[0].platform_copy.as_ref().unwrap();
    assert!(!copy.linkedin_post.is_empty());
    assert!(!copy.twitter_thread.is_empty());

    let _ = std::fs::remove_file(data_file);
    let _ = std::fs::remove_dir_all(temp_dir);
}
