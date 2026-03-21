Add-Type -AssemblyName System.Speech
[Console]::Error.WriteLine("PS: Starting...")

$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$rec.SetInputToDefaultAudioDevice()

[Console]::Error.WriteLine("PS: Grammar loaded, device set, starting async recognition...")

$rec.add_SpeechRecognized({
    param($s, $e)
    $t = $e.Result.Text
    [Console]::Error.WriteLine("PS: Recognized: $t")
    [Console]::Out.WriteLine("RESULT:$t")
    [Console]::Out.Flush()
})

$rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
[Console]::Error.WriteLine("PS: Listening — will run until killed by Node.")

# Keep alive — Node.js kills this process when dictation is stopped
while ($true) { Start-Sleep -Milliseconds 500 }
