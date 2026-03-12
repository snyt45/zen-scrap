import { App, PluginSettingTab, Setting } from "obsidian";
import type ZenScrapPlugin from "./main";

export interface ZenScrapSettings {
  scrapsFolder: string;
  imagesFolder: string;
}

export const DEFAULT_SETTINGS: ZenScrapSettings = {
  scrapsFolder: "Scraps",
  imagesFolder: "Scraps/images",
};

export class ZenScrapSettingTab extends PluginSettingTab {
  plugin: ZenScrapPlugin;

  constructor(app: App, plugin: ZenScrapPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("スクラップの保存フォルダ")
      .setDesc("スクラップファイルを保存するフォルダのパス")
      .addText((text) =>
        text
          .setPlaceholder("Scraps")
          .setValue(this.plugin.settings.scrapsFolder)
          .onChange(async (value) => {
            this.plugin.settings.scrapsFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("画像の保存フォルダ")
      .setDesc("アップロード画像を保存するフォルダのパス")
      .addText((text) =>
        text
          .setPlaceholder("Scraps/images")
          .setValue(this.plugin.settings.imagesFolder)
          .onChange(async (value) => {
            this.plugin.settings.imagesFolder = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
