import { createContext, useContext, useEffect, useRef } from 'react';

export const PageCommandContext = createContext({ command: null, onHandled: null });

// Consume each request once, including when React replays mount effects.
export const usePageCommand = (onCommand, ready = true) => {
  const { command, onHandled } = useContext(PageCommandContext);
  const handledId = useRef(null);

  useEffect(() => {
    if (!ready || !command || handledId.current === command.id) return;
    handledId.current = command.id;
    onHandled?.(command.id);
    onCommand(command.type);
  }, [command, onHandled, onCommand, ready]);
};
