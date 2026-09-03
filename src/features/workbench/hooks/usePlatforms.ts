import { useCallback, useEffect, useState } from "react";

import {
  configurePlatform,
  getPlatformConfigs,
  setPlatformEnabled,
  type PlatformConfig,
  type PlatformId,
} from "../../../lib/tauri";
import { nowText } from "../utils";

export type XTwitterFormState = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

const EMPTY_X_FORM: XTwitterFormState = {
  apiKey: "",
  apiSecret: "",
  accessToken: "",
  accessTokenSecret: "",
};

export function usePlatforms() {
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [platformsNotice, setPlatformsNotice] = useState("");
  const [xTwitterForm, setXTwitterForm] = useState<XTwitterFormState>(EMPTY_X_FORM);
  const [xTwitterSaving, setXTwitterSaving] = useState(false);

  const loadPlatforms = useCallback(async () => {
    setPlatformsLoading(true);
    try {
      const configs = await getPlatformConfigs();
      setPlatformConfigs(configs);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setPlatformsNotice(`加载平台配置失败：${msg}`);
    } finally {
      setPlatformsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  const getPlatform = useCallback(
    (platformId: PlatformId): PlatformConfig | undefined => {
      return platformConfigs.find((p) => p.platform === platformId);
    },
    [platformConfigs],
  );

  const isPlatformConfigured = useCallback(
    (platformId: PlatformId): boolean => {
      const p = platformConfigs.find((c) => c.platform === platformId);
      if (!p) return false;
      if (!p.enabled) return false;
      // Check if credentials are non-empty
      const credKeys = Object.keys(p.credentials);
      return credKeys.length > 0 && credKeys.some((k) => p.credentials[k] !== "");
    },
    [platformConfigs],
  );

  const isPlatformEnabled = useCallback(
    (platformId: PlatformId): boolean => {
      const p = platformConfigs.find((c) => c.platform === platformId);
      return p?.enabled ?? false;
    },
    [platformConfigs],
  );

  const saveXTwitterCredentials = useCallback(async () => {
    if (!xTwitterForm.apiKey.trim() || !xTwitterForm.apiSecret.trim()) {
      setPlatformsNotice("X API Key 和 API Secret 为必填项。");
      return;
    }
    if (!xTwitterForm.accessToken.trim() || !xTwitterForm.accessTokenSecret.trim()) {
      setPlatformsNotice("X Access Token 和 Access Token Secret 为必填项。");
      return;
    }

    setXTwitterSaving(true);
    setPlatformsNotice("");
    try {
      await configurePlatform("x_twitter", {
        apiKey: xTwitterForm.apiKey.trim(),
        apiSecret: xTwitterForm.apiSecret.trim(),
        accessToken: xTwitterForm.accessToken.trim(),
        accessTokenSecret: xTwitterForm.accessTokenSecret.trim(),
      });
      setXTwitterForm(EMPTY_X_FORM);
      setPlatformsNotice(`X (Twitter) 凭证已保存（${nowText()}）`);
      await loadPlatforms();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setPlatformsNotice(`保存 X 凭证失败：${msg}`);
    } finally {
      setXTwitterSaving(false);
    }
  }, [xTwitterForm, loadPlatforms]);

  const togglePlatformEnabled = useCallback(
    async (platformId: PlatformId, enabled: boolean) => {
      try {
        await setPlatformEnabled(platformId, enabled);
        await loadPlatforms();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setPlatformsNotice(`操作失败：${msg}`);
      }
    },
    [loadPlatforms],
  );

  return {
    platformConfigs,
    platformsLoading,
    platformsNotice,
    setPlatformsNotice,
    getPlatform,
    isPlatformConfigured,
    isPlatformEnabled,
    loadPlatforms,
    xTwitterForm,
    setXTwitterForm,
    xTwitterSaving,
    saveXTwitterCredentials,
    togglePlatformEnabled,
  };
}
