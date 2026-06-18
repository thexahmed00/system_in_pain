import type { NextApiRequest, NextApiResponse } from 'next'


type RequestData ={
    graph: Graph;
    levelId: string;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { graph, levelId }: RequestData = req.body;   
