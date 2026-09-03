import type { Draft } from "../types";
import type { BinanceSymbolSearchItem, PlatformConfig, PlatformId } from "../../../lib/tauri";

export function ComposerPanel({
  draft,
  setDraft,
  symbolQuery,
  setSymbolQuery,
  symbolSearching,
  symbolSearchNotice,
  symbolSearchResults,
  addSymbolFromSearch,
  manualSymbolsInput,
  setManualSymbolsInput,
  bodyTaggedSymbols,
  allSymbols,
  removeManualSymbol,
  chooseLocalVideoFile,
  composerError,
  onQueue,
  platformConfigs,
  isPlatformConfigured,
}: {
  draft: Draft;
  setDraft: (next: Draft | ((prev: Draft) => Draft)) => void;
  symbolQuery: string;
  setSymbolQuery: (v: string) => void;
  symbolSearching: boolean;
  symbolSearchNotice: string;
  symbolSearchResults: BinanceSymbolSearchItem[];
  addSymbolFromSearch: (symbol: string) => void;
  manualSymbolsInput: string;
  setManualSymbolsInput: (v: string) => void;
  bodyTaggedSymbols: string[];
  allSymbols: string[];
  removeManualSymbol: (symbol: string) => void;
  chooseLocalVideoFile: () => void;
  composerError: string;
  onQueue: () => void;
  platformConfigs: PlatformConfig[];
  isPlatformConfigured: (platformId: PlatformId) => boolean;
}) {
  const addedSymbols = new Set(allSymbols);
  const bodyTagged = new Set(bodyTaggedSymbols);

  return (
    <section className="panel composer-panel">
      <h2>内容编辑</h2>

      <div className="segment">
        <SegmentButton
          active={draft.publishType === "post"}
          label="帖子"
          onClick={() => setDraft((prev) => ({ ...prev, publishType: "post" }))}
        />
        <SegmentButton
          active={draft.publishType === "article"}
          label="文章"
          onClick={() => setDraft((prev) => ({ ...prev, publishType: "article" }))}
        />
        <SegmentButton
          active={draft.publishType === "video"}
          label="视频"
          onClick={() => setDraft((prev) => ({ ...prev, publishType: "video" }))}
        />
      </div>

      <div className="composer-grid">
        <div className="composer-main">
          <label>
            标题
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>

          {draft.publishType === "video" && (
            <>
              <div className="segment">
                <SegmentButton
                  active={draft.videoSourceType === "url"}
                  label="视频链接"
                  onClick={() => setDraft((prev) => ({ ...prev, videoSourceType: "url" }))}
                />
                <SegmentButton
                  active={draft.videoSourceType === "local"}
                  label="本地文件上传"
                  onClick={() => setDraft((prev) => ({ ...prev, videoSourceType: "local" }))}
                />
              </div>

              {draft.videoSourceType === "url" ? (
                <label>
                  视频链接
                  <input
                    value={draft.videoUrl}
                    onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </label>
              ) : (
                <label>
                  本地视频文件
                  <div className="actions file-picker">
                    <button type="button" onClick={chooseLocalVideoFile}>
                      选择文件
                    </button>
                    <input
                      value={draft.videoFilePath}
                      onChange={(e) => setDraft({ ...draft, videoFilePath: e.target.value })}
                      placeholder="已选择文件路径，或手动输入绝对路径"
                    />
                  </div>
                </label>
              )}
            </>
          )}

          <label>
            正文
            <textarea
              rows={14}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="正文须保留“信息整理，不构成投资建议”声明。"
            />
          </label>
          <p className="char-count">{draft.body.length} 字</p>
        </div>

        <div className="composer-side">
          <div className="side-block">
            <h3>发布平台</h3>
            <div className="platform-selector">
              <label className="platform-option">
                <input
                  type="checkbox"
                  checked={draft.targetPlatforms.includes("binance_square")}
                  disabled={!isPlatformConfigured("binance_square")}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.targetPlatforms, "binance_square"]
                      : draft.targetPlatforms.filter((p) => p !== "binance_square");
                    setDraft({ ...draft, targetPlatforms: next as Draft["targetPlatforms"] });
                  }}
                />
                Binance Square
                {!isPlatformConfigured("binance_square") && <em className="hint"> 未配置</em>}
              </label>
              <label className="platform-option">
                <input
                  type="checkbox"
                  checked={draft.targetPlatforms.includes("x_twitter")}
                  disabled={!isPlatformConfigured("x_twitter")}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.targetPlatforms, "x_twitter"]
                      : draft.targetPlatforms.filter((p) => p !== "x_twitter");
                    setDraft({ ...draft, targetPlatforms: next as Draft["targetPlatforms"] });
                  }}
                />
                X (Twitter)
                {!isPlatformConfigured("x_twitter") && <em className="hint"> 未配置</em>}
              </label>
            </div>
            {draft.targetPlatforms.length === 0 && (
              <p className="hint warning">请至少选择一个发布平台。</p>
            )}
          </div>

          <div className="side-block">
            <h3>相关币种</h3>
            <label>
              搜索币种（官方接口）
              <input
                value={symbolQuery}
                onChange={(e) => setSymbolQuery(e.target.value)}
                placeholder="输入 BTC / ETH / SOL 等符号"
              />
            </label>
            <div className="symbol-search-box">
              {symbolSearching && <p className="hint">搜索中...</p>}
              {!symbolSearching && symbolSearchNotice && <p className="hint">{symbolSearchNotice}</p>}
              <div className="actions">
                {symbolSearchResults.map((item) => {
                  const added = addedSymbols.has(item.symbol);
                  return (
                    <button
                      key={`${item.symbol}-${item.quoteAsset}`}
                      type="button"
                      className={added ? "ghost" : ""}
                      disabled={added}
                      onClick={() => addSymbolFromSearch(item.symbol)}
                    >
                      {item.symbol}/{item.quoteAsset}
                      {added ? " 已添加" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              手动补充币种（逗号分隔）
              <input
                value={manualSymbolsInput}
                onChange={(e) => setManualSymbolsInput(e.target.value)}
                placeholder="例如 BTC,ETH,SOL"
              />
            </label>

            <p className="hint">最终附加标签（发送时自动追加到正文末尾）：</p>
            {allSymbols.length === 0 ? (
              <p className="hint">未设置。提交前至少需要 1 个币种。</p>
            ) : (
              <div className="tag-chips">
                {allSymbols.map((symbol) => (
                  <span key={symbol} className={bodyTagged.has(symbol) ? "tag-chip locked" : "tag-chip"}>
                    #{symbol}
                    {bodyTagged.has(symbol) ? (
                      <em>正文</em>
                    ) : (
                      <button
                        type="button"
                        className="chip-remove"
                        aria-label={`移除 ${symbol}`}
                        onClick={() => removeManualSymbol(symbol)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="side-block">
            <h3>发布平台</h3>
            <div className="platform-selector">
              <label className="platform-option">
                <input
                  type="checkbox"
                  checked={draft.targetPlatforms.includes("binance_square")}
                  disabled={!isPlatformConfigured("binance_square")}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.targetPlatforms, "binance_square"]
                      : draft.targetPlatforms.filter((p) => p !== "binance_square");
                    setDraft({ ...draft, targetPlatforms: next as Draft["targetPlatforms"] });
                  }}
                />
                Binance Square
                {!isPlatformConfigured("binance_square") && <em className="hint"> 未配置</em>}
              </label>
              <label className="platform-option">
                <input
                  type="checkbox"
                  checked={draft.targetPlatforms.includes("x_twitter")}
                  disabled={!isPlatformConfigured("x_twitter")}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...draft.targetPlatforms, "x_twitter"]
                      : draft.targetPlatforms.filter((p) => p !== "x_twitter");
                    setDraft({ ...draft, targetPlatforms: next as Draft["targetPlatforms"] });
                  }}
                />
                X (Twitter)
                {!isPlatformConfigured("x_twitter") && <em className="hint"> 未配置</em>}
              </label>
            </div>
            {draft.targetPlatforms.length === 0 && (
              <p className="hint warning">请至少选择一个发布平台。</p>
            )}
          </div>

          <div className="side-block">
            <h3>提交</h3>
            <label className="inline">
              <input
                type="checkbox"
                checked={draft.reviewed}
                onChange={(e) => setDraft({ ...draft, reviewed: e.target.checked })}
              />
              已完成人工来源与风险复核
            </label>
            <p className="hint">
              提交后进入发布队列，仍需在队列页手动发送或设置定时任务，不会自动发布。
            </p>
            {composerError && <p className="form-error">{composerError}</p>}
            <button className="primary wide" disabled={!draft.reviewed} onClick={onQueue}>
              提交发布队列
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {label}
    </button>
  );
}
