// src/screens/LoginScreen.jsx
import { Alert as RNAlert } from "react-native";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../FireBase/FireBaseConfig";

const isWeb = typeof document !== "undefined";

// ─── Web-compatible Alert ────────────────────────────────────────────────────
function useWebAlert() {
  const [alertConfig, setAlertConfig] = React.useState(null);

  const showAlert = React.useCallback((title, message, buttons) => {
    if (!isWeb) {
      RNAlert.alert(title, message, buttons);
      return;
    }
    const resolvedButtons =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: "OK", style: "default" }];
    setAlertConfig({ title, message, buttons: resolvedButtons });
  }, []);

  const handlePress = (btn) => {
    setAlertConfig(null);
    if (btn.onPress) btn.onPress();
  };

  const AlertModal = alertConfig ? (
    <Modal transparent visible animationType="fade" onRequestClose={() => setAlertConfig(null)}>
      <View style={alertStyles.overlay}>
        <View style={alertStyles.dialog}>
          {alertConfig.title ? <Text style={alertStyles.title}>{alertConfig.title}</Text> : null}
          {alertConfig.message ? <Text style={alertStyles.message}>{alertConfig.message}</Text> : null}
          <View style={[alertStyles.buttonRow, alertConfig.buttons.length > 2 && alertStyles.buttonColumn]}>
            {alertConfig.buttons.map((btn, idx) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    alertStyles.btn,
                    isDestructive && alertStyles.btnDestructive,
                    isCancel && alertStyles.btnCancel,
                    alertConfig.buttons.length === 1 && alertStyles.btnSingle,
                    alertConfig.buttons.length > 2 && alertStyles.btnFull,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text style={[alertStyles.btnText, isCancel && alertStyles.btnTextCancel]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertModal };
}

const alertStyles = StyleSheet.create({
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
  buttonRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  buttonColumn: { flexDirection: "column", gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#CC0000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: "center",
  },
  btnSingle: { flex: 0, paddingHorizontal: 48 },
  btnFull: { flex: 0, width: "100%" },
  btnDestructive: { backgroundColor: "#8B0000" },
  btnCancel: { backgroundColor: "#F0F0F0" },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  btnTextCancel: { color: "#333" },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      let message = error.message;
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "Invalid email or password. Please try again or register a new account.";
      } else if (error.code === "auth/user-not-found") {
        message = "No account found with this email. Please register first.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many login attempts. Please wait and try again later.";
      }
      showAlert("Login Failed", message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/attendance_logo.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Attendance Tracker</Text>
      <Text style={styles.subtitle}>Attendance Monitoring System</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "SIGNING IN..." : "SIGN IN"}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Register</Text>
        </TouchableOpacity>
      </View>

      {AlertModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 32, justifyContent: "center" },
  logo: { width: 126, height: 126, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 32, fontWeight: "bold", color: "#CC0000", textAlign: "center" },
  subtitle: { fontSize: 12, color: "#1A3A8F", textAlign: "center", marginBottom: 40 },
  label: { fontSize: 13, color: "#CC0000", fontWeight: "bold", marginBottom: 4 },
  input: { backgroundColor: "#F5F5F5", padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 14 },
  button: { backgroundColor: "#CC0000", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  link: { color: "#1A3A8F", fontWeight: "bold" },
});