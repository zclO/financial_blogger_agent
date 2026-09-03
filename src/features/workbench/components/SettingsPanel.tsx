import type { BinanceSquareConfig, BinanceSquareProxyConfig, PlatformConfig, PlatformId } from "../../../lib/tauri";
import type { XTwitterFormState } from "../hooks/usePlatforms";

export function SettingsPanel({
  squareConfig,
  lastRefreshTime,
  squareKeyInput,
  setSquareKeyInput,
  squareNotice,
  squareLoading,
  refreshingSquare,
  openingSquare,
  onSaveSquareKey,
  onRefreshSquare,
  onOpenSquareCenter,
  proxyConfig,
  setProxyEnabled,
  proxyUrlInput,
  setProxyUrlInput,
  proxySaving,
  proxyNotice,
  onSaveProxy,
  onReloadProxy,
  platformConfigs,
  platformsNotice,
  xTwitterForm,
  setXTwitterForm,
  xTwitterSaving,
  onSaveXTwitter,
  onTogglePlatform,
}: {
  squareConfig: BinanceSquareConfig | null;
  lastRefreshTime: string;
  squareKeyInput: string;
  setSquareKeyInput: (v: string) => void;
  squareNotice: string;
  squareLoading: boolean;
  refreshingSquare: boolean;
  openingSquare: boolean;
  onSaveSquareKey: () => void;
  onRefreshSquare: () => void;
  onOpenSquareCenter: () => void;
  proxyConfig: BinanceSquareProxyConfig;
  setProxyEnabled: (v: boolean) => void;
  proxyUrlInput: string;
  setProxyUrlInput: (v: string) => void;
  proxySaving: boolean;
  proxyNotice: string;
  onSaveProxy: () => void;
  onReloadProxy: () => void;
  platformConfigs: PlatformConfig[];
  platformsNotice: string;
  xTwitterForm: XTwitterFormState;
  setXTwitterForm: (fn: XTwitterFormState | ((prev: XTwitterFormState) => XTwitterFormState)) => void;
  xTwitterSaving: boolean;
  onSaveXTwitter: () => void;
  onTogglePlatform: (platformId: PlatformId, enabled: boolean) => void;
}) {
  return (
    <section className="panel settings">
      <h2>数据源与接口配置</h2>
      <p>密钥仅通过 Rust 侧安全存储，前端不保存 Token 或 Cookie。</p>

      <div className="setting-grid">
        <div className="kv">
          <span className="key">Square OpenAPI Key 状态</span>
          <span className={squareConfig?.keyConfigured ? "status ok" : "status"}>
            {squareConfig?.keyConfigured ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="kv">
          <span className="key">最近刷新</span>
          <span className="value">{lastRefreshTime || "未刷新"}</span>
        </div>
      </div>

      <label>
        Square OpenAPI Key
        <input
          type="password"
          autoComplete="off"
          value={squareKeyInput}
          onChange={(e) => setSquareKeyInput(e.target.value)}
          placeholder="输入后仅用于调用 Rust 命令保存"
        />
      </label>

      <div className="actions">
        <button disabled={squareLoading} onClick={onSaveSquareKey}>
          {squareLoading ? "保存中..." : "保存 Key"}
        </button>
        <button disabled={refreshingSquare || squareLoading} onClick={onRefreshSquare}>
          {refreshingSquare ? "刷新中..." : "刷新状态"}
        </button>
        <button disabled={openingSquare || !squareConfig} onClick={onOpenSquareCenter}>
          {openingSquare ? "打开中..." : "打开 Creator Center"}
        </button>
      </div>
      {squareNotice && <div className="subnotice">{squareNotice}</div>}

      <hr />

      <h2>代理配置</h2>
      <p>用于发布接口请求和币种搜索请求的网络代理。支持 VPN/本地代理地址。</p>
      <label className="inline">
        <input type="checkbox" checked={proxyConfig.enabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
        启用代理发送
      </label>
      <label>
        代理地址
        <input
          value={proxyUrlInput}
          onChange={(e) => setProxyUrlInput(e.target.value)}
          placeholder="例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
        />
      </label>
      <div className="actions">
        <button disabled={proxySaving} onClick={onSaveProxy}>
          {proxySaving ? "保存中..." : "保存代理配置"}
        </button>
        <button disabled={proxySaving} onClick={onReloadProxy}>
          重新加载
        </button>
      </div>
      {proxyNotice && <div className="subnotice">{proxyNotice}</div>}

      <hr />

      <h2>发布平台</h2>
      <p>配置多平台发布凭证。凭证仅存储于本地，不会上传至云端。</p>

      {/* ── Binance Square status ── */}
      <div className="platform-card">
        <div className="platform-header">
          <h3>Binance Square</h3>
          <span className={squareConfig?.keyConfigured ? "status ok" : "status"}>
            {squareConfig?.keyConfigured ? "已配置" : "未配置"}
          </span>
        </div>
        <p className="hint">通过上方“Square OpenAPI Key”区域配置。</p>
      </div>

      {/* ── X (Twitter) ── */}
      <div className="platform-card">
        <div className="platform-header">
          <h3>X (Twitter)</h3>
          <span className={isXTwitterConfigured(platformConfigs) ? "status ok" : "status"}>
            {isXTwitterConfigured(platformConfigs) ? "已配置" : "未配置"}
          </span>
        </div>

        {isXTwitterConfigured(platformConfigs) && (
          <label className="inline">
            <input
              type="checkbox"
              checked={isXTwitterEnabled(platformConfigs)}
              onChange={(e) => onTogglePlatform("x_twitter", e.target.checked)}
            />
            启用 X (Twitter) 发布
          </label>
        )}

        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={xTwitterForm.apiKey}
            onChange={(e) => setXTwitterForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="X API Key (Consumer Key)"
          />
        </label>
        <label>
          API Secret
          <input
            type="password"
            autoComplete="off"
            value={xTwitterForm.apiSecret}
            onChange={(e) => setXTwitterForm((prev) => ({ ...prev, apiSecret: e.target.value }))}
            placeholder="X API Key Secret (Consumer Secret)"
          />
        </label>
        <label>
          Access Token
          <input
            type="password"
            autoComplete="off"
            value={xTwitterForm.accessToken}
            onChange={(e) => setXTwitterForm((prev) => ({ ...prev, accessToken: e.target.value }))}
            placeholder="X Access Token"
          />
        </label>
        <label>
          Access Token Secret
          <input
            type="password"
            autoComplete="off"
            value={xTwitterForm.accessTokenSecret}
            onChange={(e) => setXTwitterForm((prev) => ({ ...prev, accessTokenSecret: e.target.value }))}
            placeholder="X Access Token Secret"
          />
        </label>
        <div className="actions">
          <button disabled={xTwitterSaving} onClick={onSaveXTwitter}>
            {xTwitterSaving ? "保存中..." : "保存 X 凭证"}
          </button>
        </div>
      </div>

      {platformsNotice && <div className="subnotice">{platformsNotice}</div>}
    </section>
  );
}

function isXTwitterConfigured(configs: PlatformConfig[]): boolean {
  const p = configs.find((c) => c.platform === "x_twitter");
  if (!p) return false;
  const keys = Object.keys(p.credentials);
  return keys.length > 0 && keys.some((k) => p.credentials[k] !== "");
}

function isXTwitterEnabled(configs: PlatformConfig[]): boolean {
  const p = configs.find((c) => c.platform === "x_twitter");
  return p?.enabled ?? false;
}
