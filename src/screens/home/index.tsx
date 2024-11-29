import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<string[]>([]);

    // Render LaTeX on canvas and clear the main canvas
    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression((prev) => [...prev, latex]);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // Initialize MathJax
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    // Reset canvas
    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // Drawing logic
    const startDrawing = (e: any) => {
        e.preventDefault();
        const { x, y } = getCanvasCoordinates(e);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCanvasCoordinates(e);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = color;
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => setIsDrawing(false);

    const getCanvasCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const offsetX = e.touches?.[0]?.clientX || e.nativeEvent.offsetX;
            const offsetY = e.touches?.[0]?.clientY || e.nativeEvent.offsetY;
            return { x: offsetX - rect.left, y: offsetY - rect.top };
        }
        return { x: 0, y: 0 };
    };

    // API Call
    const runRoute = async () => {
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_API_URL}/calculate`,
                    {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars,
                    }
                );

                const resp = response.data;

                if (resp.status === 'success' && Array.isArray(resp.data)) {
                    resp.data.forEach((item: Response) => {
                        if (item.assign) {
                            setDictOfVars((prev) => ({
                                ...prev,
                                [item.expr]: item.result,
                            }));
                        }
                    });

                    if (resp.data.length > 0) {
                        const firstResult = resp.data[0];
                        setResult({
                            expression: firstResult.expr,
                            answer: firstResult.result,
                        });
                    }
                } else {
                    console.error('Unexpected API response format:', resp);
                }
            } catch (error) {
                console.error('API Error:', error);
            }
        }
    };

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                <Button
                    onClick={() => setReset(true)}
                    className="z-20 bg-black text-white text-lg"
                >
                    Reset
                </Button>
                <Group className="z-20">
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch key={swatch} color={swatch} onClick={() => setColor(swatch)} />
                    ))}
                </Group>
                <Button
                    onClick={runRoute}
                    className="z-20 bg-orange-500 text-white text-lg"
                >
                    Calculate
                </Button>
            </div>
            <canvas
                ref={canvasRef}
                id="canvas"
                className="absolute top-0 left-0 w-full h-full"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            {latexExpression.map((latex, index) => (
                <Draggable
                    key={index}
                    defaultPosition={latexPosition}
                    onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
                >
                    <div className="absolute p-2 text-white rounded shadow-md">
                        <div className="latex-content">{latex}</div>
                    </div>
                </Draggable>
            ))}
        </>
    );
}
