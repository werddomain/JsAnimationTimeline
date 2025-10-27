export class StateManager {
  private state: Map<string, any> = new Map();

  /**
   * Get a state value
   * @param key State key
   * @returns The state value or undefined
   */
  public get<T = any>(key: string): T | undefined {
    return this.state.get(key);
  }

  /**
   * Set a state value
   * @param key State key
   * @param value State value
   */
  public set(key: string, value: any): void {
    this.state.set(key, value);
  }

  /**
   * Check if a state exists
   * @param key State key
   * @returns True if state exists
   */
  public has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a state value
   * @param key State key
   */
  public delete(key: string): void {
    this.state.delete(key);
  }

  /**
   * Clear all state
   */
  public clear(): void {
    this.state.clear();
  }
}
