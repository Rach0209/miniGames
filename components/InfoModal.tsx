import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Rule {
  emoji: string;
  text: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  rules: Rule[];
}

export default function InfoModal({ visible, onClose, title, description, rules }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.divider} />

          <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleEmoji}>{rule.emoji}</Text>
                <Text style={styles.ruleText}>{rule.text}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1A1A1B',
    borderRadius: 14,
    padding: 24,
    width: '88%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    maxHeight: '80%',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: '#818384',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#3A3A3C',
    marginVertical: 16,
  },
  rulesScroll: {
    flexGrow: 0,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  ruleEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  ruleText: {
    color: '#D0D0D0',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  button: {
    backgroundColor: '#538D4E',
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
