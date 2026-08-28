import type { Draft, PublishType, VideoSourceType } from "../types";
import type { BinanceSymbolSearchItem } from "../../../lib/tauri";

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
  chooseLocalVideoFile,
  onQueue,
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
  chooseLocalVideoFile: () => void;
  onQueue: () => void;
}) {
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
        <div>
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
            <textarea rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
        </div>

        <div>
          <label>
            搜索币种（官方接口）
            <input value={symbolQuery} onChange={(e) => setSymbolQuery(e.target.value)} placeholder="输入 BTC / ETH / SOL 等符号" />
          </label>
          <div className="symbol-search-box">
            {symbolSearching && <p className="hint">搜索中...</p>}
            {!symbolSearching && symbolSearchNotice && <p className="hint">{symbolSearchNotice}</p>}
            <div className="actions">
              {symbolSearchResults.map((item) => (
                <button key={`${item.symbol}-${item.quoteAsset}`} type="button" onClick={() => addSymbolFromSearch(item.symbol)}>
                  {item.symbol}/{item.quoteAsset}
                </button>
              ))}
            </div>
          </div>

          <label>
            手动补充币种（逗号分隔）
            <input value={manualSymbolsInput} onChange={(e) => setManualSymbolsInput(e.target.value)} placeholder="例如 BTC,ETH,SOL" />
          </label>
          <p className="hint">正文已含标签：{bodyTaggedSymbols.length ? bodyTaggedSymbols.join(", ") : "无"}。</p>
          <p className="hint">最终标签：{allSymbols.length ? allSymbols.map((s) => `#${s} $${s}`).join(" ") : "未设置"}。</p>

          <label className="inline">
            <input type="checkbox" checked={draft.reviewed} onChange={(e) => setDraft({ ...draft, reviewed: e.target.checked })} />
            已完成人工来源与风险复核
          </label>
          <button disabled={!draft.reviewed} onClick={onQueue}>
            提交发布队列
          </button>
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
