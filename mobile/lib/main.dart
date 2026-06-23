import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const PerioVoiceAI());
}

class PerioVoiceAI extends StatefulWidget {
  const PerioVoiceAI({super.key});

  @override
  State<PerioVoiceAI> createState() => _PerioVoiceAIState();
}

class _PerioVoiceAIState extends State<PerioVoiceAI> {
  static const backendUrl = 'http://10.0.2.2:8000';

  final TextEditingController _userIdController = TextEditingController(text: 'test-user');
  final TextEditingController _messageController = TextEditingController();
  String _sessionId = '';
  String _responseText = 'Press "Start Session" first.';
  String _llmStatus = 'Unknown';
  bool _isLoading = false;

  void _updateLLMStatus(String? model) {
    if (model == null || model.isEmpty) {
      _llmStatus = 'Not configured';
    } else {
      _llmStatus = 'Configured (${model})';
    }
  }

  Future<void> _setLoading(bool value) async {
    if (mounted) setState(() => _isLoading = value);
  }

  Future<void> _showResponse(String text) async {
    if (mounted) setState(() => _responseText = text);
  }

  Future<void> _startSession() async {
    final userId = _userIdController.text.trim();
    if (userId.isEmpty) {
      await _showResponse('Enter a user ID first.');
      return;
    }

    await _setLoading(true);
    try {
      final uri = Uri.parse('$backendUrl/api/start?user_id=$userId');
      final response = await http.post(uri);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final sessionId = data['session_id'] as String?;
        if (sessionId != null) {
          setState(() => _sessionId = sessionId);
          await _showResponse('Session started.\nSession ID: $sessionId\n\n${data['greeting'] ?? ''}');
        } else {
          await _showResponse('Session started but no session_id returned.');
        }
      } else {
        await _showResponse('Failed to start session: ${response.statusCode}\n${response.body}');
      }
    } catch (e) {
      await _showResponse('Error starting session: $e');
    } finally {
      await _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> _sendMessage(String path) async {
    final userId = _userIdController.text.trim();
    final message = _messageController.text.trim();
    if (userId.isEmpty || message.isEmpty || _sessionId.isEmpty) {
      await _showResponse('Enter user ID, message, and start a session first.');
      return null;
    }

    await _setLoading(true);
    try {
      final uri = Uri.parse('$backendUrl$path');
      final payload = {
        'user_id': userId,
        'message': message,
        'input_type': 'text',
        'session_id': _sessionId,
      };
      final response = await http.post(uri,
          headers: {'Content-Type': 'application/json'}, body: jsonEncode(payload));
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      final body = response.body.isNotEmpty ? response.body : 'No body returned.';
      String errorMessage = 'Request failed (${response.statusCode}): $body';
      try {
        final parsed = jsonDecode(body) as Map<String, dynamic>;
        if (parsed.containsKey('detail')) {
          errorMessage = 'Request failed (${response.statusCode}): ${parsed['detail']}';
        }
      } catch (_) {
        // ignore JSON parse errors and keep raw body
      }
      await _showResponse(errorMessage);
      return null;
    } catch (e) {
      await _showResponse('Network error: $e');
      return null;
    } finally {
      await _setLoading(false);
    }
  }

  Future<void> _sendChat() async {
    final data = await _sendMessage('/api/chat');
    if (data == null) return;
    await _showResponse('Rule-based AI response:\n${data['response'] ?? ''}\n\nNext: ${data['next_question'] ?? 'N/A'}');
  }

  Future<void> _sendLLMChat() async {
    final data = await _sendMessage('/api/llm-chat');
    if (data == null) return;
    final model = data['model'] as String?;
    setState(() {
      _updateLLMStatus(model);
    });
    final note = model == null ? '\n\n⚠️ LLM is not configured. Set OPENAI_API_KEY in the backend to enable real LLM output.' : '';
    await _showResponse('LLM response:\n${data['response'] ?? ''}\n\nModel: ${model ?? 'unconfigured'}$note');
  }

  Future<void> _compareChat() async {
    final data = await _sendMessage('/api/compare-chat');
    if (data == null) return;
    final rule = data['rule_based'] as Map<String, dynamic>?;
    final llm = data['llm'] as Map<String, dynamic>?;
    final ruleText = rule?['response'] ?? 'No rule response';
    final llmText = llm?['response'] ?? 'No LLM response';
    final model = llm?['model'] as String?;
    setState(() {
      _updateLLMStatus(model);
    });
    final note = model == null ? '\n\n⚠️ LLM is not configured. Set OPENAI_API_KEY in the backend to enable real LLM output.' : '';
    await _showResponse('Comparison:\n\nRule-based:\n$ruleText\n\nLLM:\n$llmText$note');
  }

  Widget _actionButton(String label, IconData icon, VoidCallback onPressed) {
    return ElevatedButton.icon(
      icon: Icon(icon),
      label: Text(label),
      onPressed: _isLoading ? null : onPressed,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'PerioVoice AI',
      home: Scaffold(
        appBar: AppBar(
          title: const Text('PerioVoice AI'),
          centerTitle: true,
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                const Text(
                  'AI Dental Assistant',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                  decoration: BoxDecoration(
                    color: _llmStatus.startsWith('Configured') ? Colors.green.shade50 : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _llmStatus.startsWith('Configured') ? Colors.green : Colors.orange,
                    ),
                  ),
                  child: Text(
                    'LLM status: $_llmStatus',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _llmStatus.startsWith('Configured') ? Colors.green.shade800 : Colors.orange.shade800,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _userIdController,
                  decoration: const InputDecoration(
                    labelText: 'User ID',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _messageController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Your message',
                    hintText: 'Describe symptoms or answer a question',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                _actionButton('Start Session', Icons.play_arrow, _startSession),
                const SizedBox(height: 12),
                _actionButton('Send Rule-based Chat', Icons.chat, _sendChat),
                const SizedBox(height: 12),
                _actionButton('Send LLM Chat', Icons.smart_toy, _sendLLMChat),
                const SizedBox(height: 12),
                _actionButton('Compare Rule vs LLM', Icons.compare_arrows, _compareChat),
                const SizedBox(height: 20),
                Text(
                  'Session ID: ${_sessionId.isEmpty ? 'Not started' : _sessionId}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Text(
                    _responseText,
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Note: For Android emulator use 10.0.2.2, for a real device use your machine IP and adjust the URL accordingly.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
