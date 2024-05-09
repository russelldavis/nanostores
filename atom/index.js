import { clean } from '../clean-stores/index.js'

let listenerQueue = []
let lqIndex = 0
const QUEUE_ITEMS_PER_LISTENER = 4
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
    listenerQueue[lqIndex](
      listenerQueue[lqIndex + 1],
      listenerQueue[lqIndex + 2],
      listenerQueue[lqIndex + 3]
    )
  }
  listenerQueue.length = 0
}

export let atom = (initialValue) => {
  let listeners = []
  let $atom = {
    get() {
      if (!$atom.lc) {
        $atom.listen(() => {})()
      }
      return $atom.value
    },
    lc: 0,
    listen(_listener) {
      let lastVal
      let hasRun = false
      let listener = (value, oldValue, changedKey) => {
        if (hasRun && value === lastVal) return
        hasRun = true
        lastVal = value
        _listener(value, oldValue, changedKey)
      }
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
      if (!batchLevel) {
        for (let listener of listeners) {
          listener($atom.value, oldValue, changedKey)
        }
        return
      }
      let queueWasEmpty = !listenerQueue.length
      for (let listener of listeners) {
        listenerQueue.push(
          listener,
          $atom.value,
          oldValue,
          changedKey
        )
      }
      // if (!batchLevel && queueWasEmpty) runListenerQueue()
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
