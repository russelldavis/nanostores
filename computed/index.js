import { atom } from '../atom/index.js'
import { onMount } from '../lifecycle/index.js'

let computedStore = (stores, cb, batched) => {
  if (!Array.isArray(stores)) stores = [stores]

  let previousArgs
  let currentRunId = 0
  let isDirty = true

  let set = () => {
    if (!isDirty) return
    isDirty = false
    let args = stores.map($store => $store.get())
    if (
      previousArgs === undefined ||
      args.some((arg, i) => arg !== previousArgs[i])
    ) {
      let runId = ++currentRunId
      previousArgs = args
      let value = cb(...args)
      if (value && value.then && value.t) {
        value.then(asyncValue => {
          if (runId === currentRunId) {
            // Prevent a stale set
            $computed.set(asyncValue)
          }
        })
      } else {
        $computed.set(value)
      }
    }
  }
  let $computed = atom(undefined)
  let get = $computed.get
  $computed.get = () => {
    set()
    return get()
  }

  let timer
  let run = batched
    ? () => {
        clearTimeout(timer)
        timer = setTimeout(set)
      }
    : set
  run.onDirty = () => {
    isDirty = true
    $computed.emitDirty()
  }

  onMount($computed, () => {
    isDirty = true
    let unbinds = stores.map($store => $store.listen(run))
    set()
    return () => {
      for (let unbind of unbinds) unbind()
    }
  })

  return $computed
}

export let computed = (stores, fn) => computedStore(stores, fn)
export let batched = (stores, fn) => computedStore(stores, fn, true)
