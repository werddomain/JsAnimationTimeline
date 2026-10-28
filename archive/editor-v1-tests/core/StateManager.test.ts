import { StateManager } from '../../core/StateManager';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('set/get', () => {
    it('should store and retrieve a value', () => {
      stateManager.set('testKey', 'testValue');
      
      expect(stateManager.get('testKey')).toBe('testValue');
    });

    it('should return undefined for non-existent keys', () => {
      expect(stateManager.get('nonExistentKey')).toBeUndefined();
    });

    it('should store different types of values', () => {
      stateManager.set('string', 'hello');
      stateManager.set('number', 42);
      stateManager.set('boolean', true);
      stateManager.set('object', { a: 1, b: 2 });
      stateManager.set('array', [1, 2, 3]);
      stateManager.set('null', null);
      
      expect(stateManager.get('string')).toBe('hello');
      expect(stateManager.get('number')).toBe(42);
      expect(stateManager.get('boolean')).toBe(true);
      expect(stateManager.get('object')).toEqual({ a: 1, b: 2 });
      expect(stateManager.get('array')).toEqual([1, 2, 3]);
      expect(stateManager.get('null')).toBeNull();
    });

    it('should overwrite existing values', () => {
      stateManager.set('key', 'value1');
      stateManager.set('key', 'value2');
      
      expect(stateManager.get('key')).toBe('value2');
    });

    it('should support generic type parameter for get', () => {
      stateManager.set('typedKey', { name: 'test', count: 5 });
      
      const value = stateManager.get<{ name: string; count: number }>('typedKey');
      
      expect(value?.name).toBe('test');
      expect(value?.count).toBe(5);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      stateManager.set('existingKey', 'value');
      
      expect(stateManager.has('existingKey')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(stateManager.has('nonExistentKey')).toBe(false);
    });

    it('should return true even for null/undefined values', () => {
      stateManager.set('nullKey', null);
      stateManager.set('undefinedKey', undefined);
      
      expect(stateManager.has('nullKey')).toBe(true);
      expect(stateManager.has('undefinedKey')).toBe(true);
    });
  });

  describe('delete', () => {
    it('should remove an existing key', () => {
      stateManager.set('key', 'value');
      stateManager.delete('key');
      
      expect(stateManager.has('key')).toBe(false);
      expect(stateManager.get('key')).toBeUndefined();
    });

    it('should handle deleting non-existent keys gracefully', () => {
      // Should not throw
      expect(() => stateManager.delete('nonExistentKey')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all stored state', () => {
      stateManager.set('key1', 'value1');
      stateManager.set('key2', 'value2');
      stateManager.set('key3', 'value3');
      
      stateManager.clear();
      
      expect(stateManager.has('key1')).toBe(false);
      expect(stateManager.has('key2')).toBe(false);
      expect(stateManager.has('key3')).toBe(false);
    });
  });
});
