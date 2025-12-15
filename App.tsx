import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnalysisResult, Meal, FoodItem, Nutrients } from './types';
import { BE_FACTOR, FPE_FACTOR } from './constants';
import { analyzeMealImage, fetchSuggestion } from './services/geminiService';
import { Spinner } from './components/Spinner';
import { CameraModal } from './components/CameraModal';

// --- Helper function to convert markdown-like text to HTML ---
const formatSuggestionText = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
};

// --- Sub-components defined outside App to prevent re-creation on re-renders ---

const Header: React.FC = () => (
    <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Nährwert & BE/FPE-Rechner</h1>
        <p className="text-gray-500 mt-2">Fotografieren Sie Ihre Mahlzeit für eine detaillierte Analyse inklusive intelligenter Vorschläge.</p>
    </div>
);

interface ImageUploaderProps {
    imageData: string | null;
    onImageSelect: (file: File) => void;
}
const ImageUploader: React.FC<ImageUploaderProps> = ({ imageData, onImageSelect }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handlePlaceholderClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageSelect(e.target.files[0]);
        }
    };
    
    return (
        <div className="space-y-4">
            {!imageData && (
                <div onClick={handlePlaceholderClick} className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="mt-2 text-sm text-center">Foto aufnehmen, hochladen <br /> oder aus Zwischenablage einfügen</span>
                </div>
            )}
            {imageData && <img src={imageData} alt="Vorschau des Essens" className="w-full h-48 object-cover rounded-lg" />}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>
    );
};


interface ActionButtonsProps {
    onUploadClick: () => void;
    onCameraClick: () => void;
}
const ActionButtons: React.FC<ActionButtonsProps> = ({ onUploadClick, onCameraClick }) => (
     <div className="flex space-x-4">
        <button onClick={onCameraClick} className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-sm flex items-center justify-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H12a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M15 9a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>Kamera</span>
        </button>
        <button onClick={onUploadClick} className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all shadow-sm flex items-center justify-center space-x-2">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            <span>Hochladen</span>
        </button>
    </div>
);


interface ResultsDisplayProps {
    result: AnalysisResult;
    onCorrection: (text: string) => void;
    onSaveMeal: () => void;
    isMealSaved: boolean;
    onGetSuggestion: (type: 'alternative' | 'plan') => void;
}
const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, onCorrection, onSaveMeal, isMealSaved, onGetSuggestion }) => {
    const [correctionText, setCorrectionText] = useState('');
    const totals = result.food_items.reduce((acc, item) => {
        const n = item.nutrients;
        const be = (n.carbohydrates_grams || 0) / BE_FACTOR;
        const fpe = (((n.fat_grams || 0) * 9) + ((n.protein_grams || 0) * 4)) / FPE_FACTOR;
        acc.be += be;
        acc.fpe += fpe;
        return acc;
    }, { be: 0, fpe: 0 });

    const handleCorrection = () => {
        if (correctionText.trim()) {
            onCorrection(correctionText.trim());
        }
    };
    
    return (
        <div className="space-y-4 pt-4 border-t border-gray-200">
            {result.clarification_question && (
                <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-r-lg">
                    <p className="font-bold">Rückfrage</p>
                    <p>{result.clarification_question}</p>
                </div>
            )}
            <h2 className="text-2xl font-bold text-gray-800">Analyse-Ergebnisse</h2>
            <div className="space-y-3">
                {result.food_items.map((item, index) => {
                    const beValue = (item.nutrients.carbohydrates_grams || 0) / BE_FACTOR;
                    const fpeValue = (((item.nutrients.fat_grams || 0) * 9) + ((item.nutrients.protein_grams || 0) * 4)) / FPE_FACTOR;
                    return (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-gray-700">{item.name} (~{(item.weight_grams || 0).toFixed(0)}g)</p>
                                <div className="text-right">
                                    <p className="font-bold text-lg text-orange-600 whitespace-nowrap">🍞 {beValue.toFixed(1)} BE</p>
                                    <p className="font-bold text-md text-purple-600 whitespace-nowrap">🥩 {fpeValue.toFixed(1)} FPE</p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 mt-2 space-y-1">
                                <div className="flex justify-between"><span>🔥 Kalorien:</span> <span>{(item.nutrients.calories || 0).toFixed(0)} kcal</span></div>
                                <div className="flex justify-between"><span>💪 Protein:</span> <span>{(item.nutrients.protein_grams || 0).toFixed(1)} g</span></div>
                                <div className="flex justify-between"><span>🥑 Fett:</span> <span>{(item.nutrients.fat_grams || 0).toFixed(1)} g</span></div>
                                <div className="flex justify-between font-medium pt-1 mt-1 border-t"><span>Kohlenhydrate:</span> <span>{(item.nutrients.carbohydrates_grams || 0).toFixed(1)} g</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t">
                <h3 className="text-xl font-bold text-gray-800">Gesamtwerte der Mahlzeit</h3>
                <div className="p-4 bg-blue-50 rounded-lg text-sm mt-2 space-y-2">
                    <div className="flex justify-between items-center text-xl font-bold text-orange-700"><span>Gesamt Broteinheiten:</span><span>{totals.be.toFixed(1)} BE</span></div>
                    <div className="flex justify-between items-center text-lg font-bold text-purple-700"><span>Gesamt Fett-Protein-Einheiten:</span><span>{totals.fpe.toFixed(1)} FPE</span></div>
                </div>
            </div>

            {result.diabetic_note && (
                <div className="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-r-lg">
                    <p className="font-bold">Hinweis für Diabetiker</p>
                    <p>{result.diabetic_note}</p>
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => onGetSuggestion('alternative')} className="w-full bg-teal-500 text-white p-2 rounded-lg font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center space-x-2 text-sm">✨ Alternative vorschlagen</button>
                    <button onClick={() => onGetSuggestion('plan')} className="w-full bg-cyan-500 text-white p-2 rounded-lg font-semibold hover:bg-cyan-600 transition-colors flex items-center justify-center space-x-2 text-sm">✨ Tagesplan erstellen</button>
                </div>
                <div>
                    <button onClick={onSaveMeal} disabled={isMealSaved} className={`w-full text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${isMealSaved ? 'bg-green-500 hover:bg-green-500 cursor-default' : 'bg-blue-500 hover:bg-blue-600'}`}>
                       {!isMealSaved && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12l-5-3-5 3V4z" /></svg>}
                        <span>{isMealSaved ? 'Gespeichert!' : 'Mahlzeit speichern'}</span>
                    </button>
                </div>
                <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Korrekturen?</h3>
                    <div className="flex space-x-2">
                        <input type="text" value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="z.B. Das ist Vollkornreis..." />
                        <button onClick={handleCorrection} className="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600">Senden</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SuggestionDisplayProps {
    title: string;
    htmlContent: string;
}
const SuggestionDisplay: React.FC<SuggestionDisplayProps> = ({ title, htmlContent }) => (
    <div className="pt-4 border-t border-gray-200">
        <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
            <h4 className="text-lg font-bold text-teal-800 mb-2">{title}</h4>
            <div className="text-sm text-gray-700 space-y-2" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    </div>
);

interface HistoryListProps {
    history: Meal[];
    onClear: () => void;
}
const HistoryList: React.FC<HistoryListProps> = ({ history, onClear }) => {
    const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        // FIX: The type for the return value of `setTimeout` is not `NodeJS.Timeout` in a browser environment.
        // `ReturnType<typeof setTimeout>` provides a safe, environment-agnostic type.
        let timer: ReturnType<typeof setTimeout>;
        if (confirmClear) {
            timer = setTimeout(() => setConfirmClear(false), 3000);
        }
        return () => clearTimeout(timer);
    }, [confirmClear]);

    const handleClearClick = () => {
        if (confirmClear) {
            onClear();
            setConfirmClear(false);
        } else {
            setConfirmClear(true);
        }
    };
    
    return (
        <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-gray-800">Mahlzeiten-Verlauf</h2>
                 <button onClick={handleClearClick} className={`text-sm rounded-md transition-all duration-300 ${confirmClear ? 'bg-red-600 text-white font-semibold px-3 py-1' : 'text-red-500 hover:text-red-700 px-2 py-1'}`}>{confirmClear ? 'Wirklich löschen?' : 'Verlauf löschen'}</button>
            </div>
             <div className="space-y-3 max-h-60 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="text-center p-4"><p className="text-sm text-gray-500">Ihr Verlauf ist leer.</p></div>
                ) : (
                    history.map((meal, index) => {
                        const mealDate = new Date(meal.date);
                        const formattedDate = `${mealDate.toLocaleDateString('de-DE')} ${mealDate.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})}`;
                        const foodNames = meal.food_items.map(item => item.name).join(', ');
                        const totalCalories = meal.food_items.reduce((sum, item) => sum + (item.nutrients.calories || 0), 0).toFixed(0);
                        const totalBE = (meal.food_items.reduce((sum, item) => sum + (item.nutrients.carbohydrates_grams || 0), 0) / BE_FACTOR).toFixed(1);
                        const totalFPE = (meal.food_items.reduce((sum, item) => sum + (((item.nutrients.fat_grams || 0) * 9) + ((item.nutrients.protein_grams || 0) * 4)), 0) / FPE_FACTOR).toFixed(1);
                        return (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg border text-sm">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-gray-800 truncate pr-2" title={foodNames}>{foodNames}</p>
                                    <p className="text-xs text-gray-500 whitespace-nowrap">{formattedDate}</p>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 font-medium">
                                    <span className="text-orange-600">🍞 {totalBE} BE</span> | 
                                    <span className="text-purple-600">🥩 {totalFPE} FPE</span> |
                                    <span className="text-green-600">🔥 {totalCalories} kcal</span>
                                </p>
                            </div>
                        );
                    })
                )}
             </div>
        </div>
    );
};


// --- Main App Component ---

const App: React.FC = () => {
    const [imageData, setImageData] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [suggestion, setSuggestion] = useState<{title: string, htmlContent: string} | null>(null);
    const [mealHistory, setMealHistory] = useState<Meal[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isMealSaved, setIsMealSaved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setAnalysisResult(null);
        setSuggestion(null);
        setError(null);
        setIsMealSaved(false);
    };

    const processFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setImageData(event.target.result as string);
                resetState();
            }
        };
        reader.readAsDataURL(file);
    }, []);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        processFile(file);
                        event.preventDefault();
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [processFile]);


    const handleAnalyze = async (correctionText?: string | null) => {
        if (!imageData) return alert("Bitte zuerst ein Bild auswählen.");
        setIsLoading(true);
        setError(null);
        setSuggestion(null);
        setIsMealSaved(false);

        try {
            const result = await analyzeMealImage(imageData, correctionText);
            setAnalysisResult(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGetSuggestion = async (type: 'alternative' | 'plan') => {
        if (!analysisResult) return;
        setIsSuggestionLoading(true);
        setSuggestion(null);
        try {
            const text = await fetchSuggestion(analysisResult, type);
            const title = type === 'alternative' ? 'Verbesserungsvorschlag' : 'Vorschlag für einen Tagesplan';
            setSuggestion({ title, htmlContent: formatSuggestionText(text) });
        } catch (e) {
             setError(e instanceof Error ? `Fehler beim Erstellen des Vorschlags: ${e.message}` : 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
            setIsSuggestionLoading(false);
        }
    };

    const handleSaveMeal = () => {
        if (analysisResult && imageData && !isMealSaved) {
            const newMeal: Meal = { ...analysisResult, date: new Date().toISOString(), image: imageData };
            setMealHistory(prev => [newMeal, ...prev]);
            setIsMealSaved(true);
        }
    };

    const handleClearHistory = () => {
        setMealHistory([]);
    };
    
    const handlePictureTaken = (data: string) => {
        setImageData(data);
        resetState();
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
                <Header />
                <ImageUploader imageData={imageData} onImageSelect={processFile} />
                <ActionButtons onUploadClick={() => fileInputRef.current?.click()} onCameraClick={() => setIsCameraOpen(true)} />

                <button onClick={() => handleAnalyze()} disabled={!imageData || isLoading} className="w-full bg-green-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-600 transition-all shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                    {isLoading ? <><Spinner size="sm" /><span>Analysiere...</span></> : 'Analysieren'}
                </button>

                {(isLoading || error || analysisResult) && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        {isLoading && (
                            <div className="flex justify-center items-center space-x-2 text-gray-600"><Spinner size="md" /><p>Analysiere Mahlzeit...</p></div>
                        )}
                        {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
                        {analysisResult && !isLoading && <ResultsDisplay result={analysisResult} onCorrection={handleAnalyze} onSaveMeal={handleSaveMeal} isMealSaved={isMealSaved} onGetSuggestion={handleGetSuggestion} />}
                    </div>
                )}
                
                 {(isSuggestionLoading || suggestion) && (
                    <div className="pt-4 border-t border-gray-200">
                         {isSuggestionLoading && (
                            <div className="flex justify-center items-center space-x-2 text-gray-600 p-4"><Spinner size="md" /><p>Intelligenter Vorschlag wird erstellt...</p></div>
                        )}
                        {suggestion && !isSuggestionLoading && <SuggestionDisplay title={suggestion.title} htmlContent={suggestion.htmlContent} />}
                    </div>
                )}

                <HistoryList history={mealHistory} onClear={handleClearHistory} />

                <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onPictureTaken={handlePictureTaken} />
            </div>
        </div>
    );
};

export default App;
