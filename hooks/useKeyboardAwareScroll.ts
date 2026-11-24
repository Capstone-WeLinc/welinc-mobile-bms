import { useEffect, useRef } from "react";
import type { ScrollView, TextInput, View } from "react-native";

import { useKeyboardHeight } from "./useKeyboardHeight";

/**
 * Keeps the focused TextInput visible above the keyboard inside a ScrollView.
 *
 * Usage: put `scrollRef` on the ScrollView, `contentRef` on a View wrapping all of its
 * content, add `contentPaddingBottom` to the content style, and call
 * `onInputFocus(input)` / `onInputBlur()` from each TextInput.
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const focused = useRef<TextInput | null>(null);
  const keyboardHeight = useKeyboardHeight();

  const scrollToInput = (input: TextInput) => {
    const content = contentRef.current;
    if (!content) return;
    input.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true }),
      () => undefined,
    );
  };

  useEffect(() => {
    const input = focused.current;
    if (keyboardHeight > 0 && input) requestAnimationFrame(() => scrollToInput(input));
  }, [keyboardHeight]);

  return {
    scrollRef,
    contentRef,
    contentPaddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
    onInputFocus: (input: TextInput) => {
      focused.current = input;
      if (keyboardHeight > 0) scrollToInput(input);
    },
    onInputBlur: () => {
      focused.current = null;
    },
  };
}
