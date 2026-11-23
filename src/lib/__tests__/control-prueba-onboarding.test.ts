import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTROL_PRUEBA_ONBOARDING_VERSION,
  hasControlPruebaOnboardingSeen,
  markControlPruebaOnboardingSeen,
} from '@/lib/control-prueba-onboarding';

function mockLocalStorage() {
  const store = new Map<string, string>();
  const localStorage: Storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });
  return store;
}

describe('control-prueba onboarding persistence', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = mockLocalStorage();
  });

  it('empieza sin haber sido visto', () => {
    expect(hasControlPruebaOnboardingSeen()).toBe(false);
  });

  it('persiste que ya fue visto', () => {
    markControlPruebaOnboardingSeen();
    expect(hasControlPruebaOnboardingSeen()).toBe(true);
    expect(store.get('legalmev.control-prueba.onboarding.v1')).toBe(CONTROL_PRUEBA_ONBOARDING_VERSION);
  });
});
