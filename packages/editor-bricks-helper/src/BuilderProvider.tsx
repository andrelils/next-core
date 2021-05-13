// See https://github.com/react-dnd/react-dnd/blob/main/packages/react-dnd/src/common/DndProvider.tsx
import React from "react";
import {
  BuilderContext,
  ContextOfBuilder,
  createBuilderContext,
} from "./BuilderContext";

export const BuilderProvider = React.memo(LegacyBuilderProvider);

function createSingletonBuilderContext(
  instanceSymbol: symbol
): ContextOfBuilder {
  const ctx = window as any;
  if (!ctx[instanceSymbol]) {
    ctx[instanceSymbol] = createBuilderContext();
  }
  return ctx[instanceSymbol];
}

const refCountMap = new Map<symbol, number>();

interface BuilderProviderProps {
  templateId?: string;
}

function LegacyBuilderProvider({
  templateId,
  children,
}: React.PropsWithChildren<BuilderProviderProps>): React.ReactElement {
  const instanceSymbol = Symbol.for(
    templateId
      ? `__BRICK_NEXT_BUILDER_CONTEXT_INSTANCE_OF_TPL_${templateId}__`
      : "__BRICK_NEXT_BUILDER_CONTEXT_INSTANCE__"
  );
  const context = createSingletonBuilderContext(instanceSymbol);

  /**
   * If the global context was used to store the DND context
   * then where theres no more references to it we should
   * clean it up to avoid memory leaks
   */
  React.useEffect(() => {
    refCountMap.set(instanceSymbol, (refCountMap.get(instanceSymbol) ?? 0) + 1);

    return () => {
      refCountMap.set(instanceSymbol, refCountMap.get(instanceSymbol) - 1);

      if (refCountMap.get(instanceSymbol) === 0) {
        (window as any)[instanceSymbol] = null;
      }
    };
  }, [instanceSymbol]);

  return (
    <BuilderContext.Provider value={context}>
      {children}
    </BuilderContext.Provider>
  );
}
