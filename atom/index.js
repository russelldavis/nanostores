import { clean } from '../clean-stores/index.js'

let listenerQueue = new Map()
export let epoch = 0
let batchLevel = 0

export let batch = (cb) => {
  let queueWasEmpty = !listenerQueue.size
  ++batchLevel
  try {
    return cb()
  } finally {
    if (!--batchLevel && queueWasEmpty) {
      runListenerQueue()
    }
  }
}

let runListenerQueue = () => {
  for (let lqItem of listenerQueue.keys()) {
    lqItem._notify(listenerQueue.get(lqItem))
  }
  listenerQueue.clear()
}

export let atom = (initialValue) => {
  let listeners = []
  let $atom = {
    _notify(a) {
      // Iterates over a copy so we don't get messed up by mutations during iteration
      for (let listener of listeners) {
        listener(a)
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
      $atom.lc = listeners.push(listener)

      return () => {
        let index = listeners.indexOf(listener)
        if (~index) {
          listeners.splice(index, 1)
          if (!--$atom.lc) $atom.off()
        }
      }
    },
    notify(oldValue, changedKey) {
      epoch++
      let queueWasEmpty = !listenerQueue.size
      listenerQueue.set($atom, $atom.value)
      if (!batchLevel && queueWasEmpty) runListenerQueue()
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
      listeners = []
      $atom.lc = 0
      $atom.off()
    }
  }

  return $atom
}
