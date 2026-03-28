'use client'

import { createContext, useContext, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface ImmersiveContextValue {
  isImmersive: boolean
  setIsImmersive: Dispatch<SetStateAction<boolean>>
}

const ImmersiveContext = createContext<ImmersiveContextValue>({
  isImmersive: false,
  setIsImmersive: () => {},
})

export function ImmersiveProvider({ children }: { children: React.ReactNode }) {
  const [isImmersive, setIsImmersive] = useState(false)
  return (
    <ImmersiveContext.Provider value={{ isImmersive, setIsImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  )
}

export function useImmersive() {
  return useContext(ImmersiveContext)
}
