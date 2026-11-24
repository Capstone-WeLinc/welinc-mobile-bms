import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Current on-screen keyboard height (0 when hidden).
 *
 * The app is drawn edge-to-edge, so the screen does not shrink when the keyboard
 * opens. Add this as bottom padding on a ScrollView so inputs can scroll above it.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
