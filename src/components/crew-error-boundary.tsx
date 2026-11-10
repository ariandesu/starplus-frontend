"use client";

import * as React from "react";

/**
 * Catches render errors below the app shell (for example an unreadable
 * on-device database after a deploy) so they never look like a logged-out
 * screen. Logs the error and offers a manual reload instead of reloading
 * by itself, which would lose form input.
 */
export class CrewErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("crew view failed", error);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <p role="alert" className="px-4 py-8 text-sm text-muted-foreground">
          Something went wrong loading this view.{" "}
          <button type="button" onClick={() => window.location.reload()} className="text-accent-strong underline">
            Reload
          </button>
        </p>
      );
    }
    return this.props.children;
  }
}
