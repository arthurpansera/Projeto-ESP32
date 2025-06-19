@ -1,56 +0,0 @@
#define BUTTON_PIN 4 // Pino do botão
#define PULSES_PER_LITER 5 // Pulsos por litro (ajuste conforme necessário)
#define DEBOUNCE_DELAY 50 // Tempo de debounce em milissegundos

int pulseCount = 0;
float totalLitros = 0.0;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
int ciclosComConsumo = 0; // Variável para detectar vazamentos

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Botão com pull-up
}

void loop() {
  bool buttonState = digitalRead(BUTTON_PIN);

  // Verifica se o botão foi pressionado e faz debounce simples
  if (buttonState == LOW && lastButtonState == HIGH) {
    if (millis() - lastDebounceTime > DEBOUNCE_DELAY) {
      pulseCount++;
      lastDebounceTime = millis();
    }
  }

  lastButtonState = buttonState;

  // A cada segundo, calcula e mostra os dados
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 1000) {
    float litros = pulseCount / (float)PULSES_PER_LITER;
    totalLitros += litros;

    Serial.print("Pulsos: ");
    Serial.print(pulseCount);
    Serial.print(" | Litros nesta leitura: ");
    Serial.print(litros, 3);
    Serial.print(" | Total acumulado: ");
    Serial.println(totalLitros, 3);

    // Lógica de detecção de vazamento
    if (pulseCount > 0) {
      ciclosComConsumo++;
    } else {
      ciclosComConsumo = 0;
    }

    if (ciclosComConsumo >= 5) { // 5 ciclos seguidos com consumo
      Serial.println("⚠️ Vazamento detectado!");
    }

    pulseCount = 0;
    lastPrint = millis();
  }
}