import { useState, type Dispatch, type SetStateAction } from "react";

export function useSyncedState<T>(
    externalValue: T,
): [T, Dispatch<SetStateAction<T>>] {
    const [localValue, setLocalValue] = useState(externalValue);
    const [prevExternal, setPrevExternal] = useState(externalValue);

    if (externalValue !== prevExternal) {
        setPrevExternal(externalValue);
        setLocalValue(externalValue);
    }

    return [localValue, setLocalValue];
}
