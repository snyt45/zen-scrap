import { App, PluginSettingTab, Setting } from "obsidian";
import type ZenScrapPlugin from "./main";

export interface ZenScrapSettings {
  scrapsFolder: string;
  imagesFolder: string;
  autoEmbed: boolean;
  staleDays: number;
}

export const DEFAULT_SETTINGS: ZenScrapSettings = {
  scrapsFolder: "Scraps",
  imagesFolder: "Scraps/images",
  autoEmbed: true,
  staleDays: 7,
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

    new Setting(containerEl)
      .setName("URLの自動埋め込み")
      .setDesc("URLをペーストしたとき自動で埋め込み記法に変換する")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoEmbed)
          .onChange(async (value) => {
            this.plugin.settings.autoEmbed = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("放置中と判定する日数")
      .setDesc("更新からこの日数が経過したOpenスクラップに「放置中」ラベルを表示する（0で無効）")
      .addText((text) =>
        text
          .setPlaceholder("7")
          .setValue(String(this.plugin.settings.staleDays))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.staleDays = num;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
