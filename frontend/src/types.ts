export interface GrowthIssue {
  id: string;
  number: number;
  title: string;
  category: string;
  status: "Todo" | "In Progress" | "Active Routine" | "Done";
  priority: "Critical" | "High" | "Medium" | "Low";
  description: string;
  direct_actions: string[];
  routine_schedule?: string;
  run_count: number;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EngagementMetrics {
  reactions: number;
  comments: number;
  views: number;
  last_synced_at?: string;
}

export interface ChannelMetrics {
  views: number;
  reactions: number;
  comments: number;
}

export interface ChannelVelocity {
  views_per_day: number;
  reactions_per_day: number;
  comments_per_day: number;
  views_delta_24h: number;
  reactions_delta_24h: number;
  comments_delta_24h: number;
  trend: "Accelerating" | "Steady" | "Decelerating" | "Flat" | string;
}

export interface EngagementSnapshot {
  timestamp: string;
  views: number;
  reactions: number;
  comments: number;
  channels?: Record<string, ChannelMetrics>;
}

export interface EngagementVelocity {
  views_per_day: number;
  reactions_per_day: number;
  comments_per_day: number;
  views_delta_24h: number;
  reactions_delta_24h: number;
  comments_delta_24h: number;
  views_24h?: number;
  reactions_24h?: number;
  comments_24h?: number;
  trend: "Accelerating" | "Steady" | "Decelerating" | "Flat" | string;
  channels?: Record<string, ChannelVelocity>;
}

export interface EngagementHistoryResponse {
  snapshots: EngagementSnapshot[];
  velocity: EngagementVelocity;
}

export interface ExportRecord {
  channel: string;
  exported_at: string;
  target_path?: string;
  status: "Success" | "Copied" | string;
  external_id?: string;
  engagement?: EngagementMetrics;
}

export interface Article {
  id: string;
  title: string;
  feature: string;
  channel: string;
  angle: string;
  summary: string;
  content: string;
  backlinks: string[];
  outbound_citations: string[];
  status: "Draft" | "Ready" | "Published" | "Approved" | "Rejected";
  created_at: string;
  published_at?: string;
  slug?: string;
  image_path?: string;
  exports?: ExportRecord[];
  engagement?: EngagementMetrics;
  engagement_snapshots?: EngagementSnapshot[];
}

export interface ExportIvyWebRequest {
  target_dir?: string;
  target_images_dir?: string;
  sync_hero_image?: boolean;
  hero_format?: "dual" | "svg" | "png";
}

export interface ExportIvyWebResponse {
  success: boolean;
  file_path: string;
  slug: string;
  post_content: string;
  record: ExportRecord;
  image_path?: string;
}

export interface SyncAssetsRequest {
  target_images_dir?: string;
}

export interface SyncAssetsResponse {
  success: boolean;
  image_path: string;
  slug: string;
}

export interface UploadHeroImageRequest {
  image_data: string;
  target_images_dir?: string;
}

export interface UploadHeroImageResponse {
  success: boolean;
  image_path: string;
  slug: string;
  bytes_written: number;
}

export type HeroBannerTheme = "dark-cyan" | "midnight-emerald" | "indigo-violet" | "amber-glow";

export interface HeroBannerOptions {
  theme?: HeroBannerTheme;
  titleOverride?: string;
  categoryOverride?: string;
  summaryOverride?: string;
}

export interface ReviewItem {
  id: string;
  type: "article" | "video_demo" | "trend_synthesis" | "listing_blurb";
  title: string;
  subtitle: string;
  channel: string;
  summary: string;
  content: string;
  backlinks: string[];
  citations: string[];
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
  rawId: string;
}

export interface StoryboardScene {
  stage: "Hook" | "WorktreeIsolation" | "TestVerification" | "PrBadgeOutro" | string;
  start_second: number;
  end_second: number;
  title: string;
  visual_action: string;
  playwright_action?: string;
}

export interface PlatformCopy {
  linkedin_post: string;
  twitter_thread: string[];
  youtube_shorts_caption: string;
}

export interface AutomationConfig {
  generator_path: string;
  playwright_script: string;
  transcode_format: "mp4" | "webm" | string;
  output_video_path?: string;
}

export interface VideoDemo {
  id: string;
  feature: string;
  target_platform: string;
  duration_seconds: number;
  headline: string;
  body: string;
  storyboard: string;
  status: "Pending" | "Approved" | "Rejected" | "Published" | string;
  created_at: string;
  updated_at: string;
  scenes?: StoryboardScene[];
  platform_copy?: PlatformCopy;
  automation_config?: AutomationConfig;
}

export interface TrendTopic {
  id: string;
  source: "GitHub" | "Reddit" | "LinkedIn" | "Hacker News" | string;
  topic: string;
  url: string;
  engagement: string;
  summary: string;
  tendril_tie_in: "direct" | "subtle" | "none";
  status: "Scouted" | "Synthesizing" | "Published" | "Pending" | "Approved" | "Rejected" | string;
  generated_article_id?: string;
  created_at: string;
}

export interface Listing {
  id: string;
  name: string;
  category: "Awesome Repo" | "Dev Directory" | "Software Factory" | "Package Manager" | "Community";
  url: string;
  status: "Targeted" | "PR Submitted" | "Under Review" | "Merged" | "Live";
  pr_url?: string;
  submission_blurb: string;
  notes: string;
  blurb_status?: "Pending" | "Approved" | "Rejected" | string;
  updated_at: string;
}

export interface PackageManagerTarget {
  id: string;
  target_key: string;
  name: string;
  os: string;
  registry_repo: string;
  package_id: string;
  install_command: string;
  status: "Targeted" | "PR Submitted" | "Under Review" | "Merged" | "Live";
  pr_url?: string;
  manifest_filename: string;
  notes: string;
  updated_at: string;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  digest?: string;
  sha256?: string;
}

export interface ReleaseInfo {
  tag_name: string;
  version: string;
  assets: ReleaseAsset[];
  published_at?: string;
  fetched_at: string;
}

export interface PackageManifestResponse {
  target_key: string;
  filename: string;
  language: string;
  content: string;
  install_command: string;
  instructions: string;
  release_tag?: string;
  fetched_at?: string;
}

export interface ManifestQueryParams {
  refresh?: boolean;
  tag?: string;
}

export interface DispatchPackagePrResponse {
  task_id: string;
  message: string;
  target_key: string;
  upstream_repo: string;
  commands: string[];
}

export interface GhAuthStatus {
  authenticated: boolean;
  account?: string;
  message: string;
}

export interface AgentStatus {
  is_available: boolean;
  agy_path: string;
  version?: string;
}

export type ActiveTab =
  | "issues"
  | "articles"
  | "trends"
  | "demos"
  | "listings"
  | "packages"
  | "agent"
  | "review"
  | "flywheel"
  | "contributors"
  | "recipes"
  | "doctor"
  | "launch"
  | "playground";

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: "git" | "agent" | "keys" | "ports" | string;
  status: "Pass" | "Warning" | "Fail";
  message: string;
  remediation_command?: string;
  can_auto_fix: boolean;
}

export interface DiagnosticSummary {
  total: number;
  passed: number;
  warnings: number;
  failures: number;
  ready_for_execution: boolean;
}

export interface DiagnosticReport {
  timestamp: string;
  checks: DiagnosticCheck[];
  summary: DiagnosticSummary;
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  target_branch: string;
  estimated_duration_sec: number;
  diff_preview?: string;
  pr_summary?: string;
  custom_logs?: string[];
}

export interface DemoRunState {
  id: string;
  status: "Idle" | "Running" | "Completed" | "Failed" | string;
  current_step: number;
  step_progress_pct: number;
  logs: string[];
  diff_preview?: string;
  pr_summary?: string;
  elapsed_seconds: number;
}

export interface OnboardingMetrics {
  first_run_completed: boolean;
  demo_completed_count: number;
  diagnostic_runs_count: number;
  time_to_first_pr_seconds?: number;
  github_starred: boolean;
}

export interface RecipeParameter {
  name: string;
  description: string;
  default_value: string;
  required: boolean;
  param_type: string;
  options?: string[];
}

export interface Recipe {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  author: string;
  author_avatar?: string;
  version: string;
  tags: string[];
  promptware_template: string;
  parameters: RecipeParameter[];
  cli_snippet: string;
  forks_count: number;
  stars_count: number;
  is_official: boolean;
  badge?: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitRecipeRequest {
  name: string;
  slug: string;
  description: string;
  category: string;
  author?: string;
  author_avatar?: string;
  version?: string;
  tags?: string[];
  promptware_template: string;
  parameters?: RecipeParameter[];
  cli_snippet?: string;
}

export interface RunRecipeResponse {
  task_id: string;
  recipe_id: string;
  cli_command: string;
  message: string;
}

export interface ContributorIssue {
  id: string;
  title: string;
  description: string;
  category: "Documentation" | "CLI" | "Frontend" | "Backend" | "Tests" | string;
  difficulty: "Good First Issue" | "Help Wanted" | string;
  estimated_minutes: number;
  affected_files: string[];
  reproduction_steps: string[];
  mentor: string;
  claimed: boolean;
  claimed_by?: string;
  claimed_at?: string;
  pr_url?: string;
  github_issue_number?: number;
  github_repo?: string;
  github_sync_status?: string;
  github_sync_message?: string;
  closed?: boolean;
  closed_at?: string;
}

export interface GitHubUserSummary {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface ContributorRecord {
  name: string;
  login?: string;
  avatar_url: string;
  profile_url: string;
  contributions: string[];
  verified?: boolean;
  verified_at?: string;
  pr_url?: string;
}

export interface AllContributorsEntry {
  login: string;
  name: string;
  avatar_url: string;
  profile: string;
  contributions: string[];
}

export interface AllContributorsConfig {
  projectName: string;
  projectOwner: string;
  repoType: string;
  repoHost: string;
  files: string[];
  imageSize: number;
  commit: boolean;
  commitConvention: string;
  contributors: AllContributorsEntry[];
  contributorsPerLine: number;
  linkToUsage: boolean;
}

export interface AllContributorsRcResponse {
  content: string;
  config: AllContributorsConfig;
  contributor_count: number;
}

export interface VerifyContributorRequest {
  issue_id?: string;
  contributor_name: string;
  github_handle: string;
  contributions: string[];
  auto_generate_pr?: boolean;
}

export interface GenerateAllContributorsPrResponse {
  branch_name: string;
  pr_title: string;
  pr_body: string;
  file_path: string;
  file_content: string;
  cli_commands: string[];
  pr_url?: string;
  status: string;
}

export interface VerifyContributorResponse {
  success: boolean;
  contributor: ContributorRecord;
  issue?: ContributorIssue;
  pr?: GenerateAllContributorsPrResponse;
  message: string;
}

export interface ContributingGuideResponse {
  content: string;
  filename: string;
}

export interface AllContributorsResponse {
  contributors: ContributorRecord[];
  markdown_table: string;
  html_grid: string;
  badge_markdown: string;
}

export interface SyndicationSettings {
  devto_api_key?: string;
  hashnode_api_key?: string;
  hashnode_publication_id?: string;
  webhook_secret?: string;
  publish_as_draft: boolean;
}

export interface SyndicationStatusResponse {
  devto_configured: boolean;
  devto_key_preview?: string;
  hashnode_configured: boolean;
  hashnode_key_preview?: string;
  hashnode_publication_id?: string;
  webhook_secret_configured: boolean;
  webhook_secret_preview?: string;
  publish_as_draft: boolean;
}

export interface AuthenticityAnalysis {
  score: number;
  rating: string;
  suggestions: string[];
  keyword_matches: string[];
  penalty_reasons: string[];
}

export interface ShowHnState {
  title: string;
  url: string;
  maker_comment: string;
  authenticity_score: number;
  score_breakdown?: AuthenticityAnalysis;
}

export interface ProductHuntAssetSpec {
  name: string;
  dimensions: string;
  requirement: string;
  status: string;
}

export interface ProductHuntChecklistItem {
  id: string;
  task: string;
  completed: boolean;
}

export interface ProductHuntKit {
  taglines: string[];
  selected_tagline: string;
  first_comment: string;
  asset_specs: ProductHuntAssetSpec[];
  checklist: ProductHuntChecklistItem[];
}

export interface BetaTester {
  id: string;
  name: string;
  handle: string;
  platform: "GitHub" | "X" | "HN" | "Discord" | string;
  specialty: string;
  outreach_status:
    | "Identified"
    | "Contacted"
    | "Committed"
    | "Feedback Received"
    | "Active on Launch Day"
    | string;
  notes: string;
  updated_at: string;
}

export interface SyndicationChecklistItem {
  id: string;
  platform: "Reddit" | "Twitter/X" | "TLDR" | "Console.dev" | "Changelog" | string;
  title: string;
  instructions: string;
  blurb: string;
  completed: boolean;
}

export interface TimelineTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface TimelinePhase {
  id: string;
  phase: string;
  timing: string;
  tasks: TimelineTask[];
}

export interface LaunchCampaignState {
  show_hn: ShowHnState;
  product_hunt: ProductHuntKit;
  beta_testers: BetaTester[];
  syndication_checklist: SyndicationChecklistItem[];
  timeline: TimelinePhase[];
}

export interface AnalyzeShowHnRequest {
  title: string;
  maker_comment: string;
}

export interface UpdateBetaTesterRequest {
  outreach_status?: string;
  handle?: string;
  notes?: string;
  name?: string;
  platform?: string;
  specialty?: string;
}

export interface WorktreeFileNode {
  name: string;
  path: string;
  is_dir: boolean;
  status: "Unchanged" | "Modified" | "Created" | string;
  children?: WorktreeFileNode[];
}

export interface PlaygroundScenario {
  id: string;
  title: string;
  description: string;
  target_branch: string;
  estimated_seconds: number;
  file_tree: WorktreeFileNode[];
  diff: string;
  pr_summary: string;
  labels?: string[];
  issue_url?: string;
}

export interface VerificationGateItem {
  name: string;
  command: string;
  status: "Pending" | "Running" | "Passed" | "Failed" | string;
  duration_ms: number;
  output: string;
}

export interface PlaygroundRunState {
  id: string;
  scenario_id: string;
  status: "Idle" | "Running" | "Completed" | "Failed" | string;
  current_step: number;
  step_progress_pct: number;
  logs: string[];
  verification_gates: VerificationGateItem[];
  diff_preview?: string;
  pr_summary?: string;
  elapsed_seconds: number;
  speed_multiplier: number;
}

export interface PlaygroundMetrics {
  total_sessions: number;
  walkthroughs_completed: number;
  issues_imported: number;
  github_stars_clicked: number;
  avg_completion_seconds: number;
}

export interface BannerEmbedInfo {
  title: string;
  badge_url: string;
  target_url: string;
  markdown_snippet: string;
  html_snippet: string;
  raw_svg: string;
}

export interface ImportIssueRequest {
  issue_url?: string;
  title?: string;
  description?: string;
}

export interface PlaygroundFileInspection {
  scenario_id: string;
  path: string;
  name: string;
  status: "Unchanged" | "Modified" | "Created" | string;
  content: string;
  file_diff?: string;
  language: string;
  line_count: number;
}
