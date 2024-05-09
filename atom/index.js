import { clean } from '../clean-stores/index.js'

let listenerQueue = []
let lqIndex = 0
const QUEUE_ITEMS_PER_LISTENER = 3
export let epoch = 0
let batchLevel = 0

export let batch = (cb) => {
  let queueWasEmpty = !listenerQueue.length
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
  for (lqIndex = 0; lqIndex < listenerQueue.length; lqIndex += QUEUE_ITEMS_PER_LISTENER) {
    listenerQueue[lqIndex]._notify(listenerQueue[lqIndex + 1], listenerQueue[lqIndex + 2])
  }
  listenerQueue.length = 0
}

export let atom = (initialValue) => {
  let listeners = []
  let $atom = {
    _notify(oldValue, changedKey) {
      // Iterates over a copy so we don't get messed up by mutations during iteration
      for (let listener of listeners) {
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
      $atom.lc = listeners.push(listener)

      return () => {
        for (let i = lqIndex + QUEUE_ITEMS_PER_LISTENER; i < listenerQueue.length;) {
          if (listenerQueue[i] === listener) {
            listenerQueue.splice(i, QUEUE_ITEMS_PER_LISTENER)
          } else {
            i += QUEUE_ITEMS_PER_LISTENER
          }
        }

        let index = listeners.indexOf(listener)
        if (~index) {
          listeners.splice(index, 1)
          if (!--$atom.lc) $atom.off()
        }
      }
    },
    notify(oldValue, changedKey) {
      epoch++
      let queueWasEmpty = !listenerQueue.length
      listenerQueue.push(
        $atom,
        oldValue,
        changedKey
      )
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
