import { Plugin } from "obsidian";

export default class ZenScrapPlugin extends Plugin {
  async onload() {
    console.log("Zen Scrap loaded");
  }

  async onunload() {
    console.log("Zen Scrap unloaded");
  }
}
