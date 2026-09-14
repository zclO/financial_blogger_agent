import { useCallback, useEffect, useState } from "react";

import {
  getPlatformConfigs,
  setPlatformEnabled,
  type PlatformConfig,
  type PlatformId,
} from "../../../lib/tauri";

export function usePlatforms() {
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [platformsNotice, setPlatformsNotice] = useState("");

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
      // Check if credentials are non-empty (enabled state is separate)
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
    togglePlatformEnabled,
  };
}
