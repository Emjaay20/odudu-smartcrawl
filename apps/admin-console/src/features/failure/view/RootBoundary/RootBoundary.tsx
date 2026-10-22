import { Component, type ReactNode } from 'react';
import { RootFailure } from '#/features/failure/view/RootFailure';

interface RootBoundaryProps {
  // Read when something fails, so it names the route the router was on.
  route: () => string;
  children: ReactNode;
}

// The last boundary: whatever no route caught. It holds the error and draws.
export class RootBoundary extends Component<RootBoundaryProps, { failed: [unknown] | null }> {
  override state: { failed: [unknown] | null } = { failed: null };

  static getDerivedStateFromError(error: unknown): { failed: [unknown] } {
    return { failed: [error] };
  }

  override render(): ReactNode {
    const { failed } = this.state;
    if (failed === null) return this.props.children;
    return <RootFailure error={failed[0]} route={this.props.route()} />;
  }
}
