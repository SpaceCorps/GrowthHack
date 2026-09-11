import React, { useState, useMemo } from "react";
import type { Recipe, SubmitRecipeRequest } from "../types";
import {
  Sparkles,
  Star,
  GitFork,
  Copy,
  Check,
  Terminal,
  Play,
  FileCode,
  X,
  Search,
  Plus,
  ShieldCheck,
  Tag,
  User,
  Layers,
} from "lucide-react";

interface RecipeHubProps {
  recipes: Recipe[];
  onRefresh?: () => Promise<void> | void;
  onRunRecipe?: (recipeId: string, parameters: Record<string, string>) => Promise<void> | void;
}

export const RecipeHub: React.FC<RecipeHubProps> = ({ recipes, onRefresh, onRunRecipe }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Configurator Modal State
  const [configRecipe, setConfigRecipe] = useState<Recipe | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [copiedConfigCmd, setCopiedConfigCmd] = useState<boolean>(false);
  const [isRunningRecipe, setIsRunningRecipe] = useState<boolean>(false);

  // Promptware YAML Drawer State
  const [yamlDrawerRecipe, setYamlDrawerRecipe] = useState<Recipe | null>(null);
  const [copiedYaml, setCopiedYaml] = useState<boolean>(false);

  // Community Submission Modal State
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [submitName, setSubmitName] = useState<string>("");
  const [submitSlug, setSubmitSlug] = useState<string>("");
  const [submitCategory, setSubmitCategory] = useState<string>("Maintenance");
  const [submitAuthor, setSubmitAuthor] = useState<string>("");
  const [submitDescription, setSubmitDescription] = useState<string>("");
  const [submitTags, setSubmitTags] = useState<string>("");
  const [submitTemplate, setSubmitTemplate] = useState<string>(
    `name: Custom Workflow
version: 1.0.0
description: Community contributed automation recipe
steps:
  - id: analyze
    action: Analyze codebase context
    gate: Verification/PreExecution
  - id: execute
    action: Run targeted workflow steps
    gate: Verification/AllTests`,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const categories = ["All", "Maintenance", "Security", "Testing", "Code Quality", "Database"];

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesCategory =
        selectedCategory === "All" ||
        recipe.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.slug.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [recipes, selectedCategory, searchQuery]);

  // Copy to clipboard helper
  const handleCopy = async (text: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedSlug(id);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Open parameter configurator
  const openConfigurator = (recipe: Recipe) => {
    setConfigRecipe(recipe);
    const initialParams: Record<string, string> = {};
    recipe.parameters.forEach((p) => {
      initialParams[p.name] = p.default_value;
    });
    setParamValues(initialParams);
    setCopiedConfigCmd(false);
  };

  // Resolve dynamic CLI snippet in configurator
  const resolvedCliSnippet = useMemo(() => {
    if (!configRecipe) return "";
    let snippet =
      configRecipe.cli_snippet ||
      `curl -s -X POST http://localhost:4200/api/recipes/${configRecipe.slug}/run`;
    const appliedKeys: string[] = [];

    configRecipe.parameters.forEach((param) => {
      const val = paramValues[param.name] ?? param.default_value;
      const placeholder = `<${param.name}>`;
      if (snippet.includes(placeholder)) {
        snippet = snippet.replaceAll(placeholder, val);
        appliedKeys.push(param.name);
      }
    });

    Object.entries(paramValues).forEach(([k, v]) => {
      if (!appliedKeys.includes(k)) {
        const flag = `--${k}=${v}`;
        if (!snippet.includes(flag)) {
          snippet += ` ${flag}`;
        }
      }
    });

    return snippet;
  }, [configRecipe, paramValues]);

  // Execute configured recipe
  const handleExecuteRecipe = async () => {
    if (!configRecipe) return;
    setIsRunningRecipe(true);
    try {
      if (onRunRecipe) {
        await onRunRecipe(configRecipe.id, paramValues);
      } else {
        await fetch(`/api/recipes/${configRecipe.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parameters: paramValues }),
        });
      }
      setConfigRecipe(null);
    } catch (err) {
      console.error("Failed to run recipe:", err);
    } finally {
      setIsRunningRecipe(false);
    }
  };

  // Community recipe submission
  const handleSubmitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const tagsArray = submitTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload: SubmitRecipeRequest = {
      name: submitName,
      slug: submitSlug,
      category: submitCategory,
      author: submitAuthor || undefined,
      description: submitDescription,
      tags: tagsArray,
      promptware_template: submitTemplate,
      parameters: [
        {
          name: "target",
          description: "Target file or module path",
          default_value: "src/",
          required: true,
          param_type: "string",
        },
      ],
      cli_snippet: `curl -s -X POST http://localhost:4200/api/recipes/${submitSlug}/run -H "Content-Type: application/json" -d '{"parameters":{"target":"<target>"}}'`,
    };

    try {
      const res = await fetch("/api/recipes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Submission failed");
      }

      setShowSubmitModal(false);
      setSubmitName("");
      setSubmitSlug("");
      setSubmitAuthor("");
      setSubmitDescription("");
      setSubmitTags("");
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit recipe");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats calculation
  const totalRecipes = recipes.length;
  const officialCount = recipes.filter((r) => r.is_official).length;
  const communityCount = recipes.filter((r) => !r.is_official).length;
  const totalStars = recipes.reduce((acc, r) => acc + (r.stars_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero Header & Stats */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready-to-Run Workflow Pack & Recipe Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Curated Promptware Recipes & Automation Packs
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Accelerate developer onboarding and eliminate blank-canvas friction with 1-click
              execution recipes. Run gold-standard bugfixers, security patchers, test generators,
              and database migrators, or contribute community promptwares.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-3">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Community Recipe</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Total Recipes</div>
            <div className="text-xl font-bold text-white mt-0.5">{totalRecipes}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Official Core Packs</div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{officialCount}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Community Pioneers</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{communityCount}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400 font-medium">Community Stars</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5 flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{totalStars}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Category Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search recipes by name, slug, tag, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recipe Cards Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800/80 p-8">
          <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No recipes found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No workflows matched your search query or selected category filter. Try clearing filters
            or submit a new recipe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex flex-col justify-between bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="space-y-3.5">
                {/* Header badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700/60">
                      {recipe.category}
                    </span>
                    {recipe.is_official ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Official</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <User className="w-3 h-3" />
                        <span>Community</span>
                      </span>
                    )}
                  </div>

                  {/* Stars & Forks */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>{recipe.stars_count}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3.5 h-3.5 text-slate-400" />
                      <span>{recipe.forks_count}</span>
                    </span>
                  </div>
                </div>

                {/* Title & Slug */}
                <div>
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {recipe.name}
                  </h3>
                  <div className="font-mono text-xs text-indigo-400 mt-0.5">
                    recipe/{recipe.slug}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  {recipe.description}
                </p>

                {/* Author with badge */}
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>
                    By <strong className="text-slate-200">{recipe.author}</strong>
                  </span>
                  {recipe.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {recipe.badge}
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-800/80 text-slate-400"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 mt-5 pt-4 border-t border-slate-800">
                {/* 1-Click Copy CLI trigger */}
                <button
                  onClick={() =>
                    handleCopy(
                      `curl -s -X POST http://localhost:4200/api/recipes/${recipe.slug}/run`,
                      recipe.id,
                    )
                  }
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 font-mono text-xs text-slate-200 transition-colors"
                >
                  <span className="truncate mr-2">
                    curl -s -X POST http://localhost:4200/api/recipes/{recipe.slug}/run
                  </span>
                  <span className="flex-shrink-0 text-slate-400 group-hover:text-white">
                    {copiedSlug === recipe.id ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-sans font-medium text-[11px]">
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                {/* Secondary buttons: Customize & View YAML */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openConfigurator(recipe)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Customize & Run</span>
                  </button>
                  <button
                    onClick={() => {
                      setYamlDrawerRecipe(recipe);
                      setCopiedYaml(false);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>View YAML</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parameter Configurator Modal */}
      {configRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Configure Recipe: {configRecipe.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Customize parameters and generate tailored Tendril CLI execution command
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigRecipe(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Parameters dynamic inputs */}
              <div className="space-y-3.5">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Parameters
                </div>
                {configRecipe.parameters.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    No parameters required for this recipe.
                  </div>
                ) : (
                  configRecipe.parameters.map((param) => (
                    <div key={param.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-200">
                          {param.name} {param.required && <span className="text-red-400">*</span>}
                        </label>
                        <span className="text-[10px] text-slate-400">{param.param_type}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{param.description}</p>
                      {param.param_type === "select" &&
                      param.options &&
                      param.options.length > 0 ? (
                        <select
                          value={paramValues[param.name] ?? param.default_value}
                          onChange={(e) =>
                            setParamValues({ ...paramValues, [param.name]: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          {param.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={paramValues[param.name] ?? param.default_value}
                          onChange={(e) =>
                            setParamValues({ ...paramValues, [param.name]: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Dynamic CLI Preview */}
              <div className="space-y-1.5 pt-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Live Command Preview
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-indigo-300 break-all select-all">
                  {resolvedCliSnippet}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-950/60 border-t border-slate-800">
              <button
                onClick={async () => {
                  try {
                    if (navigator?.clipboard?.writeText) {
                      await navigator.clipboard.writeText(resolvedCliSnippet);
                    }
                    setCopiedConfigCmd(true);
                    setTimeout(() => setCopiedConfigCmd(false), 2000);
                  } catch (err) {
                    console.error("Failed to copy:", err);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                {copiedConfigCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Command</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfigRecipe(null)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteRecipe}
                  disabled={isRunningRecipe}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isRunningRecipe ? "Starting..." : "Execute in Tendril"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promptware YAML Drawer */}
      {yamlDrawerRecipe && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {yamlDrawerRecipe.name} Promptware
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    recipe/{yamlDrawerRecipe.slug} (v{yamlDrawerRecipe.version})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setYamlDrawerRecipe(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Promptware Specification
                  </span>
                  <span className="text-xs text-slate-400 font-mono">YAML</span>
                </div>
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                  <code>{yamlDrawerRecipe.promptware_template}</code>
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                onClick={async () => {
                  try {
                    if (navigator?.clipboard?.writeText) {
                      await navigator.clipboard.writeText(yamlDrawerRecipe.promptware_template);
                    }
                    setCopiedYaml(true);
                    setTimeout(() => setCopiedYaml(false), 2000);
                  } catch (err) {
                    console.error("Failed to copy:", err);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                {copiedYaml ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied YAML!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy YAML</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setYamlDrawerRecipe(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community Recipe Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Submit Community Recipe</h3>
                  <p className="text-xs text-slate-400">
                    Contribute a ready-to-run promptware pack to the Tendril ecosystem
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRecipe}>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Contributor Badge Callout */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-emerald-300 leading-relaxed">
                    <strong>Contributor Program:</strong> Every approved recipe receives the{" "}
                    <span className="font-semibold underline">Community Pioneer</span> badge and
                    earns author credit across Tendril Hubs!
                  </div>
                </div>

                {submitError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">
                      Recipe Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Docstring Generator"
                      value={submitName}
                      onChange={(e) => setSubmitName(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">
                      Slug <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. docstring-generator"
                      value={submitSlug}
                      onChange={(e) =>
                        setSubmitSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                      }
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Category</label>
                    <select
                      value={submitCategory}
                      onChange={(e) => setSubmitCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {categories
                        .filter((c) => c !== "All")
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Author Handle</label>
                    <input
                      type="text"
                      placeholder="e.g. your_github_username"
                      value={submitAuthor}
                      onChange={(e) => setSubmitAuthor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of workflow behavior, gates, and outcomes..."
                    value={submitDescription}
                    onChange={(e) => setSubmitDescription(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. docs, python, openapi"
                    value={submitTags}
                    onChange={(e) => setSubmitTags(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    Promptware Specification YAML <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={submitTemplate}
                    onChange={(e) => setSubmitTemplate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 bg-slate-950/60 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Submitting..." : "Submit Recipe"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
