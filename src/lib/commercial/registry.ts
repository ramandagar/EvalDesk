// ============================================================================
// Commercial capability registry — the open-core seam. The MIT core defines the
// capability INTERFACES and a registry that is EMPTY by default, so the open-
// source build compiles and runs a full eval with every commercial capability
// disabled. Commercial packages (hosted cloud / enterprise) register concrete
// implementations at boot; the core only ever asks the registry "is X enabled?"
// and degrades gracefully when it isn't. No commercial code is imported here
// (enforced by scripts/check-open-core.mjs).
// ============================================================================

export type Capability = "sso" | "scim" | "suite-loader" | "pdf-render";

export class CommercialFeatureError extends Error {
  readonly status = 402; // Payment Required — feature is commercial-only
  constructor(public readonly capability: Capability) {
    super(`"${capability}" is a commercial feature and is not enabled in this build`);
    this.name = "CommercialFeatureError";
  }
}

export interface SsoProvider {
  /** Begin an SSO login, returning the IdP redirect URL. */
  authorizeUrl(orgId: string, redirectUri: string): Promise<string>;
  /** Exchange an IdP callback for a verified user identity. */
  callback(orgId: string, params: Record<string, string>): Promise<{ email: string; externalId: string }>;
}

export interface ScimProvider {
  /** Provision/deprovision a member from an external directory event. */
  applyEvent(orgId: string, event: unknown): Promise<{ applied: boolean }>;
}

export interface SuiteLoader {
  /** Load a commercial compliance pack's manifest by id (e.g. "hipaa"). */
  load(suiteId: string): Promise<unknown>;
}

export interface PdfRenderer {
  render(certificateCanonicalJson: string): Promise<Uint8Array>;
}

interface CapabilityMap {
  sso: SsoProvider;
  scim: ScimProvider;
  "suite-loader": SuiteLoader;
  "pdf-render": PdfRenderer;
}

export class CommercialRegistry {
  private impls = new Map<Capability, unknown>();

  register<K extends Capability>(capability: K, impl: CapabilityMap[K]): void {
    this.impls.set(capability, impl);
  }

  isEnabled(capability: Capability): boolean {
    return this.impls.has(capability);
  }

  /** Get an implementation or throw CommercialFeatureError (402) when absent. */
  require<K extends Capability>(capability: K): CapabilityMap[K] {
    const impl = this.impls.get(capability);
    if (!impl) throw new CommercialFeatureError(capability);
    return impl as CapabilityMap[K];
  }

  get<K extends Capability>(capability: K): CapabilityMap[K] | null {
    return (this.impls.get(capability) as CapabilityMap[K]) ?? null;
  }

  /** Capabilities currently enabled (for a /capabilities surface). */
  enabled(): Capability[] {
    return [...this.impls.keys()];
  }
}

/** The default, OPEN-SOURCE registry: nothing registered → everything disabled. */
export const openCoreRegistry = new CommercialRegistry();
