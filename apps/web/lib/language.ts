import {
  isRunnableLanguage,
  isSupportedLanguage,
  LANGUAGE_REGISTRY,
  type Language,
  SUPPORTED_LANGUAGES,
} from "@sandbox/shared";

export { isRunnableLanguage, isSupportedLanguage, LANGUAGE_REGISTRY, type Language, SUPPORTED_LANGUAGES };

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  pyw: "python",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  java: "java",
  go: "go",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  rb: "ruby",
  php: "php",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  yml: "yaml",
  yaml: "yaml",
  txt: "plaintext",
};

export function languageForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export function getLanguageLabel(lang: string | undefined): string {
  if (!lang) return "Plaintext";
  const norm = lang.toLowerCase();
  if (isSupportedLanguage(norm)) {
    const reg = LANGUAGE_REGISTRY[norm];
    return `${reg.name} (${reg.runtimeLabel})`;
  }
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function getTemplateForLanguage(lang: string | undefined): string {
  if (!lang) return "";
  const norm = lang.toLowerCase();
  if (isSupportedLanguage(norm)) {
    return LANGUAGE_REGISTRY[norm].templateCode;
  }
  return "";
}
