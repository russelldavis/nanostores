import { clean } from '../clean-stores/index.js'

let batchQueue = []
let batchOldValues = new Map()
let batchChangedKeys = new Map()
let batchLevel = 0
let batchIndex = 0
export let epoch = 0

export let batch = (cb) => {
  let queueWasEmpty = !batchQueue.length
  ++batchLevel
  try {
    return cb()
  } finally {
    if (!--batchLevel && queueWasEmpty) {
      runBatchQueue()
    }
  }
}

let runBatchQueue = () => {
  for (batchIndex = 0; batchIndex < batchQueue.length; batchIndex++) {
    batchQueue[batchIndex]._notify()
  }
  batchQueue.length = 0
}


export let atom = (initialValue) => {
  let listeners = new Set()
  let $atom = {
    _notify(oldValue, changedKey) {
      let oldValue = batchOldValues.get($atom)
      let changedKey = batchChangedKeys.get($atom)
      // Iterates over a copy so we don't get messed up by mutations during iteration
      for (let listener of listeners) {
        // Left off here: what if this atom's value changes in the middle of this loop
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
