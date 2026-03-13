import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CorePluginDescriptor } from "@/lib/plugin-contract";
import { createPrefixAliasMatcher } from "@/lib/panel-matchers";
import * as sdk from "@/plugins/sdk";

type RuntimePluginListItem = {
  pluginId: string;
  name: string;
  title?: string | null;
  installPath: string;
  fileCount: number;
  manifestOk: boolean;
  manifestError?: string | null;
};

type RuntimePluginSource = {
  pluginId: string;
  installPath: string;
  manifestJson: string;
  entryPath: string;
  entrySource: string;
};

type RuntimePluginModuleApi = {
  React: typeof React;
  sdk: typeof sdk;
  createPrefixAliasMatcher: typeof createPrefixAliasMatcher;
};

type RuntimePluginFactory = (api: RuntimePluginModuleApi) => CorePluginDescriptor;
type RuntimeGlobalScope = typeof globalThis & {
  __searchieRuntimeApi?: RuntimePluginModuleApi;
  __searchieRuntimePluginFactory?: RuntimePluginFactory;
};

const FACTORY_GLOBAL_KEY = "__searchieRuntimePluginFactory";

function buildRuntimeApi(): RuntimePluginModuleApi {
  return {
    React,
    sdk,
    createPrefixAliasMatcher,
  };
}

function isCorePluginDescriptor(value: unknown): value is CorePluginDescriptor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const descriptor = value as Partial<CorePluginDescriptor>;
  return (
    typeof descriptor.id === "string" &&
    typeof descriptor.name === "string" &&
    typeof descriptor.version === "string" &&
    Array.isArray(descriptor.permissions) &&
    Array.isArray(descriptor.panels)
  );
}

async function executeRuntimeModule(source: RuntimePluginSource): Promise<CorePluginDescriptor> {
  const runtimeApi = buildRuntimeApi();
  const globalScope = globalThis as RuntimeGlobalScope;

  const previousRuntimeApi = globalScope.__searchieRuntimeApi;
  const previousFactory = globalScope.__searchieRuntimePluginFactory;
  globalScope.__searchieRuntimeApi = runtimeApi;
  globalScope.__searchieRuntimePluginFactory = undefined;

  const blob = new Blob([source.entrySource], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const moduleExports = await import(/* @vite-ignore */ blobUrl);

    let descriptorCandidate: unknown;
    if (typeof moduleExports.default === "function") {
      descriptorCandidate = moduleExports.default(runtimeApi);
    } else if (isCorePluginDescriptor(moduleExports.default)) {
      descriptorCandidate = moduleExports.default;
    } else {
      const runtimeFactory = (globalThis as Record<string, unknown>)[FACTORY_GLOBAL_KEY];
      if (typeof runtimeFactory === "function") {
        descriptorCandidate = (runtimeFactory as RuntimePluginFactory)(runtimeApi);
      }
    }

    if (!isCorePluginDescriptor(descriptorCandidate)) {
      throw new Error(
        `plugin '${source.pluginId}' did not provide a valid runtime descriptor. ` +
          `Expected default export factory or global ${FACTORY_GLOBAL_KEY} factory.`,
      );
    }

    return descriptorCandidate;
  } finally {
    URL.revokeObjectURL(blobUrl);
    globalScope.__searchieRuntimeApi = previousRuntimeApi;
    globalScope.__searchieRuntimePluginFactory = previousFactory;
  }
}

export async function loadRuntimePlugins(): Promise<CorePluginDescriptor[]> {
  const installed = await invoke<RuntimePluginListItem[]>("list_installed_runtime_plugins");
  const candidates = installed.filter((plugin) => plugin.manifestOk);

  const loaded: CorePluginDescriptor[] = [];

  for (const plugin of candidates) {
    try {
      const source = await invoke<RuntimePluginSource>("read_runtime_plugin_source", {
        pluginId: plugin.pluginId,
      });
      const descriptor = await executeRuntimeModule(source);
      loaded.push(descriptor);
    } catch (error) {
      console.error(`[runtime-plugin-loader] failed loading ${plugin.pluginId}:`, error);
    }
  }

  return loaded;
}
