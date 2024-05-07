import { clean } from '../clean-stores/index.js'

let batchQueue = new Map()
let batchChangedKeys = new Map()
let batchLevel = 0
export let epoch = 0

export let batch = (cb) => {
  ++batchLevel
  try {
    return cb()
  } finally {
    if (!--batchLevel && batchQueue.size) {
      let oldQueue = batchQueue
      let oldBatchChangedKeys = batchChangedKeys
      batchQueue = new Map()
      batchChangedKeys = new Map()
      batch(() => {
        // Not destructuring queueEntry or changeEntry gives better perf
        for (let $atom of oldQueue.keys()) {
          $atom._notify(oldQueue.get($atom), oldBatchChangedKeys.get($atom))
        }
      })
    }
  }
}

export let atom = (initialValue) => {
  let listeners = new Set()
  let $atom = {
    _notify(oldValue, changedKey) {
      // Iterates over a copy so we don't get messed up by mutations during iteration
      for (let listener of listeners) {
        // if (listeners.has(listener))
        listener($atom.get(), oldValue, changedKey)
      }
    },
    get() {
      if (!$atom.lc) {
        $atom.listen(() => {})()
      }
      return $atom.value
    },
    lc: 0,
    listen(listener) {
      listeners.add(listener)
      $atom.lc = listeners.size

      return () => {
        if (listeners.delete(listener)) {
          if (!--$atom.lc) $atom.off()
        }
      }
    },
    notify(oldValue, changedKey) {
      epoch++
      if (!batchLevel) {
        batch(() => $atom._notify(oldValue, changedKey))
        return
      }
      if (!batchQueue.has($atom)) {
        batchQueue.set($atom, oldValue)
        if (changedKey !== undefined) batchChangedKeys.set($atom, changedKey)
      } else if (changedKey !== batchChangedKeys.get($atom)) {
        batchChangedKeys.delete($atom)
      }
    },
    /* It will be called on last listener unsubscribing.
       We will redefine it in onMount and onStop. */
    off() {},
    set(newValue) {
      let oldValue = $atom.value
      if (oldValue !== newValue) {
        $atom.value = newValue
        $atom.notify(oldValue)
      }
    },
    subscribe(listener) {
      let unbind = $atom.listen(listener)
      listener($atom.value)
      return unbind
    },
    value: initialValue
  }

  if (process.env.NODE_ENV !== 'production') {
    $atom[clean] = () => {
      listeners.clear()
      $atom.lc = 0
      $atom.off()
    }
  }

  return $atom
}
