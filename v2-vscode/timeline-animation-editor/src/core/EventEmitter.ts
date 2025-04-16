export class EventEmitter<T extends string> {
    private listeners: { [K in T]?: Array<{ sender: any; listener: (data: any) => void }> } = {};

    public on(event: T, sender: any, listener: (data: any) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]!.push({ sender, listener });
    }

    public off(event: T, listener: (data: any) => void): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event]!.filter(item => item.listener !== listener);
    }

    public emit(event: T, data: any): void {
        if (!this.listeners[event]) return;
        this.listeners[event]!.forEach(item => item.listener.call(item.sender, data));
    }
}