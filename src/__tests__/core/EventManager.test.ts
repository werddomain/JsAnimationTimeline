import { EventManager, ICancellableEvent } from '../../core/EventManager';

describe('EventManager', () => {
  let eventManager: EventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  describe('on/emit', () => {
    it('should register and call event listeners', () => {
      const callback = jest.fn();
      eventManager.on('testEvent', callback);
      
      eventManager.emit('testEvent', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      eventManager.on('testEvent', callback1);
      eventManager.on('testEvent', callback2);
      
      eventManager.emit('testEvent', { data: 'test' });
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not call listeners for different events', () => {
      const callback = jest.fn();
      eventManager.on('eventA', callback);
      
      eventManager.emit('eventB', { data: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass data correctly to listeners', () => {
      let receivedData: unknown;
      eventManager.on('testEvent', (data: unknown) => {
        receivedData = data;
      });
      
      const testData = { key: 'value', number: 42 };
      eventManager.emit('testEvent', testData);
      
      expect(receivedData).toEqual(testData);
    });
  });

  describe('off', () => {
    it('should remove a specific listener', () => {
      const callback = jest.fn();
      eventManager.on('testEvent', callback);
      eventManager.off('testEvent', callback);
      
      eventManager.emit('testEvent', { data: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should only remove the specified listener', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      eventManager.on('testEvent', callback1);
      eventManager.on('testEvent', callback2);
      eventManager.off('testEvent', callback1);
      
      eventManager.emit('testEvent', { data: 'test' });
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle removing non-existent listener gracefully', () => {
      const callback = jest.fn();
      
      // Should not throw
      expect(() => eventManager.off('nonExistentEvent', callback)).not.toThrow();
    });
  });

  describe('emitCancellable', () => {
    it('should return a cancellable event object', () => {
      const event = eventManager.emitCancellable('testEvent', { data: 'test' });
      
      expect(event).toHaveProperty('eventName', 'testEvent');
      expect(event).toHaveProperty('data', { data: 'test' });
      expect(event).toHaveProperty('defaultPrevented', false);
      expect(typeof event.preventDefault).toBe('function');
    });

    it('should allow listeners to prevent default', () => {
      eventManager.on('testEvent', (event: ICancellableEvent) => {
        event.preventDefault();
      });
      
      const event = eventManager.emitCancellable('testEvent', { data: 'test' });
      
      expect(event.defaultPrevented).toBe(true);
    });

    it('should not have default prevented if no listener calls preventDefault', () => {
      eventManager.on('testEvent', () => {
        // Do nothing - don't call preventDefault
      });
      
      const event = eventManager.emitCancellable('testEvent', { data: 'test' });
      
      expect(event.defaultPrevented).toBe(false);
    });

    it('should call all listeners even when one prevents default', () => {
      const callback1 = jest.fn((event: ICancellableEvent) => {
        event.preventDefault();
      });
      const callback2 = jest.fn();
      
      eventManager.on('testEvent', callback1);
      eventManager.on('testEvent', callback2);
      
      eventManager.emitCancellable('testEvent', { data: 'test' });
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      eventManager.on('eventA', callback1);
      eventManager.on('eventB', callback2);
      
      eventManager.clear();
      
      eventManager.emit('eventA', {});
      eventManager.emit('eventB', {});
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });
});
