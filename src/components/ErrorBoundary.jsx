import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="min-h-screen bg-[#008080] flex items-center justify-center p-4 font-sans">
                    <div className="window w-full max-w-[500px] shadow-xl">
                        <div className="title-bar bg-gradient-to-r from-red-800 to-red-600">
                            <div className="title-bar-text">Application Error</div>
                            <div className="title-bar-controls">
                                <button aria-label="Close"></button>
                            </div>
                        </div>
                        <div className="window-body">
                            <div className="flex gap-4 items-start mb-4">
                                <div className="text-4xl">❌</div>
                                <div>
                                    <h3 className="font-bold text-lg mb-2">Something went wrong.</h3>
                                    <p className="mb-2">The application encountered an unexpected error and needs to close.</p>
                                    <details className="whitespace-pre-wrap font-mono text-xs bg-gray-100 border p-2 mb-2 max-h-40 overflow-auto">
                                        {this.state.error && this.state.error.toString()}
                                        <br />
                                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                                    </details>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-1 font-bold"
                                >
                                    Reload App
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
