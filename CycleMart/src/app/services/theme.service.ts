import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  constructor() {
    // Set light theme as default and only theme
    this.setLightTheme();
  }

  private setLightTheme(): void {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Keep these methods for compatibility but they won't do anything
  setTheme(): void {
    // Always light mode
  }

  toggleTheme(): void {
    // Always light mode
  }

  getCurrentTheme(): string {
    return 'light';
  }

  isDarkMode(): boolean {
    return false;
  }
}
