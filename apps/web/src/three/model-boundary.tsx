import { Component, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };

// A step model that fails to load must not take the page down: the provisional mannequin takes over.
export class ModelBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
