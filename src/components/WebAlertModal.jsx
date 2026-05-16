import React, { useState, useCallback } from "react";
import {
  Alert as RNAlert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const isWeb = typeof document !== "undefined";

export default function useWebAlert() {
  const [config, setConfig] = useState(null);

  const showAlert = useCallback((title, message, buttons) => {
    if (!isWeb) {
      RNAlert.alert(title, message, buttons);
      return;
    }
    setConfig({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "OK" }],
    });
  }, []);

  const onPress = (btn) => {
    setConfig(null);
    btn.onPress?.();
  };

  const AlertModal = config ? (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => setConfig(null)}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          {config.title ? <Text style={s.title}>{config.title}</Text> : null}
          {config.message ? (
            <Text style={s.message}>{config.message}</Text>
          ) : null}
          <View style={[s.btnRow, config.buttons.length > 2 && s.btnCol]}>
            {config.buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.btn,
                  btn.style === "destructive" && s.btnDanger,
                  btn.style === "cancel" && s.btnCancel,
                  config.buttons.length === 1 && s.btnSingle,
                  config.buttons.length > 2 && s.btnFull,
                ]}
                onPress={() => onPress(btn)}
              >
                <Text
                  style={[s.btnText, btn.style === "cancel" && s.btnTextCancel]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertModal };
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dialog: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  btnCol: {
    flexDirection: "column",
    gap: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: "#CC0000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: "center",
  },
  btnSingle: {
    flex: 0,
    paddingHorizontal: 48,
  },
  btnFull: {
    flex: 0,
    width: "100%",
  },
  btnDanger: {
    backgroundColor: "#8B0000",
  },
  btnCancel: {
    backgroundColor: "#F0F0F0",
  },
  btnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  btnTextCancel: {
    color: "#333",
  },
});
