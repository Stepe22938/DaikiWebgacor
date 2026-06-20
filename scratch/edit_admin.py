import sys

path = 'artifacts/mc-roleplay/src/pages/admin.tsx'
content = open(path, encoding='utf-8').read()

old_state = """  const [settingsForm, setSettingsForm] = useState({
    realmName: "",
    realmLogoUrl: "",
    heroTitle: "",
    heroSubtitle: "",
    serverIP: "",
    mcVersion: "",
    specsCpu: "",
    specsMemory: "",
    specsStorage: "",
    specsLocation: "",
  });

  const [hasInitializedForm, setHasInitializedForm] = useState(false);
  if (currentSettings && !hasInitializedForm) {
    setSettingsForm({
      realmName: currentSettings.realmName || "Arcadia Guild",
      realmLogoUrl: currentSettings.realmLogoUrl || "",
      heroTitle: currentSettings.heroTitle || "",
      heroSubtitle: currentSettings.heroSubtitle || "",
      serverIP: currentSettings.serverIP || "",
      mcVersion: currentSettings.mcVersion || "",
      specsCpu: currentSettings.specsCpu || "",
      specsMemory: currentSettings.specsMemory || "",
      specsStorage: currentSettings.specsStorage || "",
      specsLocation: currentSettings.specsLocation || "",
    });
    setHasInitializedForm(true);
  }"""

new_state = """  const [settingsForm, setSettingsForm] = useState({
    realmName: "",
    realmLogoUrl: "",
    heroTitle: "",
    heroSubtitle: "",
    serverIP: "",
    mcVersion: "",
    specsCpu: "",
    specsMemory: "",
    specsStorage: "",
    specsLocation: "",
    sayabayarApiKey: "",
    premiumPrice: 25000,
    premiumPlusPrice: 50000,
  });

  const [hasInitializedForm, setHasInitializedForm] = useState(false);
  if (currentSettings && !hasInitializedForm) {
    setSettingsForm({
      realmName: currentSettings.realmName || "Arcadia Guild",
      realmLogoUrl: currentSettings.realmLogoUrl || "",
      heroTitle: currentSettings.heroTitle || "",
      heroSubtitle: currentSettings.heroSubtitle || "",
      serverIP: currentSettings.serverIP || "",
      mcVersion: currentSettings.mcVersion || "",
      specsCpu: currentSettings.specsCpu || "",
      specsMemory: currentSettings.specsMemory || "",
      specsStorage: currentSettings.specsStorage || "",
      specsLocation: currentSettings.specsLocation || "",
      sayabayarApiKey: currentSettings.sayabayarApiKey || "",
      premiumPrice: currentSettings.premiumPrice ?? 25000,
      premiumPlusPrice: currentSettings.premiumPlusPrice ?? 50000,
    });
    setHasInitializedForm(true);
  }"""

old_render = """                    </div>

                    <Button
                      onClick={() => saveSettings.mutate(settingsForm)}
                      disabled={saveSettings.isPending}
                      className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-10 shadow-md shadow-violet-500/5 mt-4"
                    >
                      {saveSettings.isPending ? "Calibrating systems..." : "Save Realm Configurations"}
                    </Button>"""

new_render = """                    </div>

                    <div className="border-t border-[#eae8f5] pt-4 mt-6 space-y-4">
                      <h3 className="font-extrabold text-xs text-[#110e3d] uppercase tracking-wider">SayaBayar & Pricing Settings</h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">SayaBayar API Key</Label>
                          <Input
                            type="password"
                            value={settingsForm.sayabayarApiKey}
                            onChange={(e) => setSettingsForm({ ...settingsForm, sayabayarApiKey: e.target.value })}
                            placeholder="Enter your sayabayar.com API key..."
                            className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Premium Plan Price (IDR)</Label>
                            <Input
                              type="number"
                              value={settingsForm.premiumPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, premiumPrice: parseInt(e.target.value) || 0 })}
                              placeholder="25000"
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600">Premium+ Plan Price (IDR)</Label>
                            <Input
                              type="number"
                              value={settingsForm.premiumPlusPrice}
                              onChange={(e) => setSettingsForm({ ...settingsForm, premiumPlusPrice: parseInt(e.target.value) || 0 })}
                              placeholder="50000"
                              className="bg-slate-50 border-[#eae8f5] rounded-xl text-xs h-9 text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => saveSettings.mutate(settingsForm)}
                      disabled={saveSettings.isPending}
                      className="w-full bg-[#6366f1] text-white hover:bg-violet-600 rounded-xl font-bold text-xs h-10 shadow-md shadow-violet-500/5 mt-4"
                    >
                      {saveSettings.isPending ? "Calibrating systems..." : "Save Realm Configurations"}
                    </Button>"""

content_normalized = content.replace('\r\n', '\n')
old_state_n = old_state.replace('\r\n', '\n')
new_state_n = new_state.replace('\r\n', '\n')
old_render_n = old_render.replace('\r\n', '\n')
new_render_n = new_render.replace('\r\n', '\n')

if old_state_n in content_normalized:
    content_normalized = content_normalized.replace(old_state_n, new_state_n)
    print("Replaced state successfully.")
else:
    print("Could not find old state in content.")

if old_render_n in content_normalized:
    content_normalized = content_normalized.replace(old_render_n, new_render_n)
    print("Replaced render successfully.")
else:
    print("Could not find old render in content.")

open(path, 'w', encoding='utf-8').write(content_normalized)
print("Done editing admin.tsx")
