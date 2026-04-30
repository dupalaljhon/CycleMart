import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private promptEvent: any;

  constructor(private swUpdate: SwUpdate) {
    // Listen for app updates
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        if (confirm('New version available! Load new version?')) {
          window.location.reload();
        }
      });

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (event: any) => {
      event.preventDefault();
      this.promptEvent = event;
    });
  }

  get canInstall(): boolean {
    return !!this.promptEvent;
  }

  async installPwa(): Promise<void> {
    if (!this.promptEvent) {
      return;
    }

    this.promptEvent.prompt();
    const { outcome } = await this.promptEvent.userChoice;
    // Clear the prompt event after use
    this.promptEvent = null;
  }

  checkForUpdates(): void {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.checkForUpdate();
    }
  }
}
